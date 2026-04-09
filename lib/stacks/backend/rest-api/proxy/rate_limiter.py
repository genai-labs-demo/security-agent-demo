"""
Rate limiting module using token bucket algorithm with DynamoDB for distributed state.

Implements per-user rate limiting to prevent resource exhaustion and database enumeration.
Uses DynamoDB for state persistence across Lambda invocations.
"""

import logging
import time
import os
from typing import Dict, Any, Optional, Tuple
import boto3
from botocore.exceptions import ClientError

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# DynamoDB client
dynamodb = boto3.resource('dynamodb')

# Rate limit configuration
RATE_LIMIT_ENABLED = os.environ.get('RATE_LIMIT_ENABLED', 'true').lower() == 'true'
RATE_LIMIT_TABLE_NAME = os.environ.get('RATE_LIMIT_TABLE_NAME', 'crm-rate-limits')

# Rate limit policies for different operations
RATE_LIMIT_POLICIES = {
    'search': {
        'requests_per_minute': 30,
        'requests_per_hour': 200,
        'burst_capacity': 10,
    },
    'default': {
        'requests_per_minute': 60,
        'requests_per_hour': 1000,
        'burst_capacity': 20,
    }
}


class RateLimitExceeded(Exception):
    """Exception raised when rate limit is exceeded."""
    def __init__(self, message: str, retry_after: int, limit: int, remaining: int, reset_time: int):
        super().__init__(message)
        self.retry_after = retry_after
        self.limit = limit
        self.remaining = remaining
        self.reset_time = reset_time


class TokenBucketRateLimiter:
    """
    Token bucket rate limiter with DynamoDB backend for distributed state.
    
    Implements two-level rate limiting:
    1. Per-minute limit with burst capacity
    2. Per-hour limit for sustained usage
    
    Uses DynamoDB to track token buckets across Lambda invocations.
    """
    
    def __init__(self, table_name: str = RATE_LIMIT_TABLE_NAME):
        """
        Initialize rate limiter with DynamoDB table.
        
        Args:
            table_name: Name of DynamoDB table for rate limit state
        """
        self.table_name = table_name
        self.table = None
        try:
            self.table = dynamodb.Table(table_name)
        except Exception as e:
            logger.warning(f"Failed to connect to DynamoDB table {table_name}: {str(e)}")
    
    def check_rate_limit(
        self,
        user_id: str,
        endpoint: str,
        policy_name: str = 'default'
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Check if request is within rate limit and consume token if allowed.
        
        Args:
            user_id: Unique identifier for the user (from auth context or IP)
            endpoint: API endpoint being accessed
            policy_name: Rate limit policy to apply ('search', 'default')
        
        Returns:
            Tuple of (allowed: bool, rate_limit_info: dict)
            
        Raises:
            RateLimitExceeded: If rate limit is exceeded
        """
        if not RATE_LIMIT_ENABLED:
            logger.info("Rate limiting is disabled")
            return True, self._get_default_rate_limit_info()
        
        if not self.table:
            logger.warning("Rate limit table not available, allowing request")
            return True, self._get_default_rate_limit_info()
        
        policy = RATE_LIMIT_POLICIES.get(policy_name, RATE_LIMIT_POLICIES['default'])
        
        try:
            # Get current state from DynamoDB
            current_time = int(time.time())
            key = f"{user_id}:{endpoint}"
            
            response = self.table.get_item(Key={'rate_limit_key': key})
            
            if 'Item' in response:
                item = response['Item']
                minute_tokens = float(item.get('minute_tokens', 0))
                hour_tokens = float(item.get('hour_tokens', 0))
                last_refill_minute = int(item.get('last_refill_minute', current_time))
                last_refill_hour = int(item.get('last_refill_hour', current_time))
            else:
                # First request - initialize with full capacity
                minute_tokens = policy['burst_capacity']
                hour_tokens = policy['requests_per_hour']
                last_refill_minute = current_time
                last_refill_hour = current_time
            
            # Refill tokens based on time elapsed
            minute_tokens, last_refill_minute = self._refill_tokens(
                minute_tokens,
                last_refill_minute,
                current_time,
                policy['requests_per_minute'],
                policy['burst_capacity'],
                60  # 1 minute window
            )
            
            hour_tokens, last_refill_hour = self._refill_tokens(
                hour_tokens,
                last_refill_hour,
                current_time,
                policy['requests_per_hour'],
                policy['requests_per_hour'],
                3600  # 1 hour window
            )
            
            # Check if tokens available
            if minute_tokens < 1:
                # Minute limit exceeded
                retry_after = 60 - (current_time - last_refill_minute)
                reset_time = last_refill_minute + 60
                rate_limit_info = {
                    'limit': policy['requests_per_minute'],
                    'remaining': 0,
                    'reset': reset_time,
                    'retry_after': max(1, retry_after),
                    'window': 'minute'
                }
                logger.warning(f"Rate limit exceeded for {user_id} on {endpoint} (minute limit)")
                raise RateLimitExceeded(
                    f"Rate limit exceeded: {policy['requests_per_minute']} requests per minute. Retry after {retry_after} seconds.",
                    retry_after=max(1, retry_after),
                    limit=policy['requests_per_minute'],
                    remaining=0,
                    reset_time=reset_time
                )
            
            if hour_tokens < 1:
                # Hour limit exceeded
                retry_after = 3600 - (current_time - last_refill_hour)
                reset_time = last_refill_hour + 3600
                rate_limit_info = {
                    'limit': policy['requests_per_hour'],
                    'remaining': 0,
                    'reset': reset_time,
                    'retry_after': max(1, retry_after),
                    'window': 'hour'
                }
                logger.warning(f"Rate limit exceeded for {user_id} on {endpoint} (hour limit)")
                raise RateLimitExceeded(
                    f"Rate limit exceeded: {policy['requests_per_hour']} requests per hour. Retry after {retry_after} seconds.",
                    retry_after=max(1, retry_after),
                    limit=policy['requests_per_hour'],
                    remaining=0,
                    reset_time=reset_time
                )
            
            # Consume tokens
            minute_tokens -= 1
            hour_tokens -= 1
            
            # Update DynamoDB
            self.table.put_item(
                Item={
                    'rate_limit_key': key,
                    'minute_tokens': minute_tokens,
                    'hour_tokens': hour_tokens,
                    'last_refill_minute': last_refill_minute,
                    'last_refill_hour': last_refill_hour,
                    'ttl': current_time + 86400  # 24 hour TTL for cleanup
                }
            )
            
            # Return rate limit info
            rate_limit_info = {
                'limit': policy['requests_per_minute'],
                'remaining': int(minute_tokens),
                'reset': last_refill_minute + 60,
                'retry_after': 0,
                'window': 'minute'
            }
            
            logger.info(f"Rate limit check passed for {user_id} on {endpoint}: {int(minute_tokens)} tokens remaining")
            return True, rate_limit_info
            
        except RateLimitExceeded:
            # Re-raise rate limit exceptions
            raise
        except Exception as e:
            # Log error but allow request to proceed (fail open)
            logger.error(f"Error checking rate limit: {str(e)}", exc_info=True)
            return True, self._get_default_rate_limit_info()
    
    def _refill_tokens(
        self,
        current_tokens: float,
        last_refill: int,
        current_time: int,
        refill_rate: int,
        max_capacity: int,
        window_seconds: int
    ) -> Tuple[float, int]:
        """
        Refill tokens based on time elapsed since last refill.
        
        Args:
            current_tokens: Current token count
            last_refill: Timestamp of last refill
            current_time: Current timestamp
            refill_rate: Tokens to refill per window
            max_capacity: Maximum token capacity
            window_seconds: Window size in seconds
        
        Returns:
            Tuple of (new_token_count, new_last_refill_time)
        """
        time_elapsed = current_time - last_refill
        
        if time_elapsed >= window_seconds:
            # Full window elapsed, refill to max capacity
            return float(max_capacity), current_time
        else:
            # Partial refill based on time elapsed
            tokens_to_add = (time_elapsed / window_seconds) * refill_rate
            new_tokens = min(current_tokens + tokens_to_add, max_capacity)
            return new_tokens, last_refill
    
    def _get_default_rate_limit_info(self) -> Dict[str, Any]:
        """Get default rate limit info when rate limiting is disabled."""
        return {
            'limit': 999999,
            'remaining': 999999,
            'reset': int(time.time()) + 3600,
            'retry_after': 0,
            'window': 'none'
        }
