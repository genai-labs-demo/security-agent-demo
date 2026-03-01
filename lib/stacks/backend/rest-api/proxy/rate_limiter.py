"""Rate limiting for opportunity creation using DynamoDB."""

import os
import time
import logging
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()

dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.environ.get('RATE_LIMIT_TABLE_NAME', 'CRM-RateLimits')
PER_MINUTE_LIMIT = int(os.environ.get('OPPORTUNITY_CREATE_RATE_LIMIT', '10'))
PER_HOUR_LIMIT = int(os.environ.get('OPPORTUNITY_CREATE_HOUR_LIMIT', '50'))
HIGH_VALUE_AMOUNT = float(os.environ.get('HIGH_VALUE_THRESHOLD', '1000000'))


class RateLimitError(Exception):
    """Rate limit exceeded."""
    def __init__(self, msg: str, retry: int = 60):
        self.message = msg
        self.retry_after = retry
        super().__init__(self.message)


def get_dynamodb_table():
    """Get rate limit table."""
    try:
        tbl = dynamodb.Table(TABLE_NAME)
        tbl.load()
        return tbl
    except ClientError as err:
        logger.error(f"DynamoDB error: {err}")
        raise Exception(f"Rate limit table unavailable: {err}")


def check_window_limit(uid: str, window_sec: int, max_req: int):
    """
    Check request count in time window.
    Returns (is_allowed, remaining, retry_seconds).
    """
    try:
        tbl = get_dynamodb_table()
        now = int(time.time())
        key_name = f"{uid}:opp_create:{window_sec}"
        
        resp = tbl.get_item(Key={'bucket_key': key_name})
        
        if 'Item' in resp:
            data = resp['Item']
            win_start = int(data.get('window_start', 0))
            req_count = int(data.get('count', 0))
            
            if now - win_start < window_sec:
                # Still in current window
                if req_count >= max_req:
                    # Limit hit
                    wait = window_sec - (now - win_start)
                    logger.warning(f"Limit hit: {uid}, window={window_sec}")
                    return False, 0, max(wait, 1)
                else:
                    # Increment counter
                    new_count = req_count + 1
                    tbl.put_item(Item={
                        'bucket_key': key_name,
                        'user_id': uid,
                        'window_start': win_start,
                        'count': new_count,
                        'expires_at': now + window_sec + 300,
                    })
                    left = max_req - new_count
                    return True, left, 0
            else:
                # Window expired, start new
                tbl.put_item(Item={
                    'bucket_key': key_name,
                    'user_id': uid,
                    'window_start': now,
                    'count': 1,
                    'expires_at': now + window_sec + 300,
                })
                return True, max_req - 1, 0
        else:
            # First request
            tbl.put_item(Item={
                'bucket_key': key_name,
                'user_id': uid,
                'window_start': now,
                'count': 1,
                'expires_at': now + window_sec + 300,
            })
            return True, max_req - 1, 0
    except Exception as err:
        logger.error(f"Rate check error: {err}")
        # Allow on error
        return True, -1, 0


def check_create_rate(user_id: str, opp_amount=None):
    """
    Validate rate limits for opportunity creation.
    Raises RateLimitError if exceeded.
    """
    if not user_id:
        logger.warning("Missing user_id in rate check")
        return
    
    # Log high-value opportunities
    if opp_amount and opp_amount > HIGH_VALUE_AMOUNT:
        logger.warning(
            f"High-value opp: user={user_id}, amt=${opp_amount:,.2f}"
        )
    
    try:
        # Per-minute check
        ok_min, left_min, wait_min = check_window_limit(
            user_id, 60, PER_MINUTE_LIMIT
        )
        if not ok_min:
            raise RateLimitError(
                f"Limit: {PER_MINUTE_LIMIT} opportunities/minute. "
                f"Wait {wait_min}s.",
                retry=wait_min
            )
        
        # Per-hour check
        ok_hr, left_hr, wait_hr = check_window_limit(
            user_id, 3600, PER_HOUR_LIMIT
        )
        if not ok_hr:
            raise RateLimitError(
                f"Limit: {PER_HOUR_LIMIT} opportunities/hour. "
                f"Wait {wait_hr}s.",
                retry=wait_hr
            )
        
        logger.info(
            f"Rate OK: {user_id}, min_left={left_min}, hr_left={left_hr}"
        )
    except RateLimitError:
        raise
    except Exception as err:
        logger.error(f"Rate limit failed: {err}")
        logger.warning("Allowing (fail-open)")


def log_bulk_activity(user_id: str, op_count: int, seconds: int):
    """Log potential bulk operations."""
    if op_count > 5 and seconds < 10:
        logger.warning(
            f"Bulk activity: user={user_id}, "
            f"count={op_count}, window={seconds}s"
        )
        return True
    return False


def get_user_from_context(event):
    """Extract user ID from API Gateway event context."""
    ctx = event.get('requestContext', {})
    return ctx.get('authorizer', {}).get('claims', {}).get('sub')
