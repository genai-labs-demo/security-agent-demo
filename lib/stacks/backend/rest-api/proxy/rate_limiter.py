"""
Rate limiting module for Lambda API endpoints.

Implements application-level rate limiting to prevent resource exhaustion
and protect against denial of service attacks. Uses token bucket algorithm
for smooth rate limiting with burst capacity.

Security: CWE-770 - Allocation of Resources Without Limits or Throttling
"""

import time
import logging
from typing import Dict, Any, Optional, Tuple
from collections import defaultdict
import os

logger = logging.getLogger()


class TokenBucket:
    """
    Token bucket algorithm implementation for rate limiting.
    
    Allows burst traffic up to bucket capacity while maintaining
    average rate limit over time.
    """
    
    def __init__(self, capacity: int, refill_rate: float):
        """
        Initialize token bucket.
        
        Args:
            capacity: Maximum number of tokens (burst capacity)
            refill_rate: Tokens added per second
        """
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = capacity
        self.last_refill = time.time()
    
    def consume(self, tokens: int = 1) -> bool:
        """
        Try to consume tokens from bucket.
        
        Args:
            tokens: Number of tokens to consume
            
        Returns:
            True if tokens were consumed, False if insufficient tokens
        """
        self._refill()
        
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False
    
    def _refill(self):
        """Refill tokens based on elapsed time."""
        now = time.time()
        elapsed = now - self.last_refill
        
        # Add tokens based on elapsed time and refill rate
        tokens_to_add = elapsed * self.refill_rate
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill = now
    
    def get_retry_after(self) -> int:
        """
        Calculate seconds until next token is available.
        
        Returns:
            Seconds to wait before retry
        """
        if self.tokens >= 1:
            return 0
        
        tokens_needed = 1 - self.tokens
        seconds = tokens_needed / self.refill_rate
        return max(1, int(seconds))


class RateLimiter:
    """
    Application-level rate limiter for Lambda API requests.
    
    Uses in-memory token buckets per client identifier.
    For production scale, consider using DynamoDB or ElastiCache Redis.
    """
    
    def __init__(self):
        """Initialize rate limiter with configurable limits."""
        # Store token buckets per client
        self.buckets: Dict[str, TokenBucket] = {}
        
        # Default rate limits (configurable via environment variables)
        self.default_rate_limit = int(os.environ.get('RATE_LIMIT_PER_MINUTE', '100'))
        self.default_burst_limit = int(os.environ.get('RATE_LIMIT_BURST', '150'))
        
        # Convert per-minute to per-second for token bucket
        self.refill_rate = self.default_rate_limit / 60.0
        
        logger.info(f"Rate limiter initialized: {self.default_rate_limit} requests/min, "
                   f"burst: {self.default_burst_limit}")
    
    def check_rate_limit(self, client_id: str, cost: int = 1) -> Tuple[bool, Optional[int]]:
        """
        Check if request is within rate limit.
        
        Args:
            client_id: Unique identifier for client (IP, user ID, etc.)
            cost: Number of tokens to consume (default: 1)
            
        Returns:
            Tuple of (allowed: bool, retry_after: Optional[int])
            - allowed: True if request is allowed, False if rate limited
            - retry_after: Seconds to wait before retry (only if not allowed)
        """
        # Get or create token bucket for this client
        if client_id not in self.buckets:
            self.buckets[client_id] = TokenBucket(
                capacity=self.default_burst_limit,
                refill_rate=self.refill_rate
            )
        
        bucket = self.buckets[client_id]
        
        # Try to consume tokens
        if bucket.consume(cost):
            return True, None
        else:
            retry_after = bucket.get_retry_after()
            logger.warning(f"Rate limit exceeded for client {client_id}. "
                         f"Retry after {retry_after} seconds")
            return False, retry_after
    
    def cleanup_old_buckets(self, max_age_seconds: int = 3600):
        """
        Remove token buckets that haven't been used recently.
        Helps prevent memory growth in long-running Lambda containers.
        
        Args:
            max_age_seconds: Remove buckets older than this (default: 1 hour)
        """
        now = time.time()
        old_clients = []
        
        for client_id, bucket in self.buckets.items():
            if now - bucket.last_refill > max_age_seconds:
                old_clients.append(client_id)
        
        for client_id in old_clients:
            del self.buckets[client_id]
        
        if old_clients:
            logger.info(f"Cleaned up {len(old_clients)} old rate limit buckets")
