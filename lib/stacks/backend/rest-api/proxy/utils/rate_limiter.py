"""
Rate limiting utility for API endpoints.

Implements sliding window rate limiting to prevent abuse and bulk operations.
Uses in-memory storage by default (suitable for development/single Lambda).
For production at scale, consider Redis/ElastiCache for distributed rate limiting.
"""

import logging
import time
import os
from typing import Dict, List, Tuple
from threading import Lock

logger = logging.getLogger()
logger.setLevel(logging.INFO)


class RateLimiter:
    """
    Sliding window rate limiter with configurable limits.
    
    Thread-safe implementation using locks for concurrent Lambda execution.
    Automatically expires old entries to prevent memory growth.
    """
    
    def __init__(self, max_requests: int = 100, window_seconds: int = 3600):
        """
        Initialize rate limiter with configurable limits.
        
        Args:
            max_requests: Maximum number of requests allowed per window
            window_seconds: Time window in seconds (default: 1 hour)
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: Dict[str, List[float]] = {}
        self._lock = Lock()
        
        logger.info(
            f"RateLimiter initialized: {max_requests} requests per "
            f"{window_seconds} seconds"
        )
    
    def is_allowed(self, user_id: str) -> Tuple[bool, int]:
        """
        Check if a request from the user is allowed under rate limits.
        
        Uses sliding window algorithm:
        1. Remove expired timestamps outside the current window
        2. Count remaining requests in the window
        3. Allow if count is below limit, otherwise deny
        
        Args:
            user_id: Unique identifier for the user (e.g., Cognito sub claim)
        
        Returns:
            Tuple of (is_allowed: bool, retry_after_seconds: int)
            - is_allowed: True if request is allowed, False if rate limit exceeded
            - retry_after_seconds: Seconds until rate limit resets (0 if allowed)
        """
        with self._lock:
            current_time = time.time()
            window_start = current_time - self.window_seconds
            
            # Initialize user's request history if not exists
            if user_id not in self._requests:
                self._requests[user_id] = []
            
            # Remove expired timestamps outside the current window
            self._requests[user_id] = [
                timestamp for timestamp in self._requests[user_id]
                if timestamp > window_start
            ]
            
            # Count requests in the current window
            request_count = len(self._requests[user_id])
            
            if request_count >= self.max_requests:
                # Rate limit exceeded - calculate retry after time
                oldest_timestamp = min(self._requests[user_id])
                retry_after = int(oldest_timestamp + self.window_seconds - current_time) + 1
                
                logger.warning(
                    f"Rate limit exceeded for user {user_id}: "
                    f"{request_count}/{self.max_requests} requests in window. "
                    f"Retry after {retry_after} seconds"
                )
                return False, retry_after
            
            # Allow request and record timestamp
            self._requests[user_id].append(current_time)
            
            logger.info(
                f"Rate limit check passed for user {user_id}: "
                f"{request_count + 1}/{self.max_requests} requests in window"
            )
            return True, 0
    
    def get_usage(self, user_id: str) -> Tuple[int, int]:
        """
        Get current usage statistics for a user.
        
        Args:
            user_id: Unique identifier for the user
        
        Returns:
            Tuple of (current_count, max_allowed)
        """
        with self._lock:
            current_time = time.time()
            window_start = current_time - self.window_seconds
            
            if user_id not in self._requests:
                return 0, self.max_requests
            
            # Count non-expired requests
            valid_requests = [
                timestamp for timestamp in self._requests[user_id]
                if timestamp > window_start
            ]
            return len(valid_requests), self.max_requests


# Singleton instance with configuration from environment variables
_rate_limiter_instance = None
_instance_lock = Lock()
