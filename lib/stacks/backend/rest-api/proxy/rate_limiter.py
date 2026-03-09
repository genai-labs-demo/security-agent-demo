"""
Rate limiting middleware for API endpoints using DynamoDB.
Prevents abuse by limiting requests per IP address per minute.
"""

import os
import time
import logging
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()

# DynamoDB table reference
_dynamodb_table = None

# Rate limit tiers (requests per minute)
LIMITS = {
    'public': 50,        # Public unauthenticated endpoints
    'protected': 200,    # Authenticated endpoints  
    'mutation': 20,      # Write operations
}

def _get_table():
    """Get or initialize DynamoDB table connection."""
    global _dynamodb_table
    if _dynamodb_table is None:
        table_name = os.environ.get('RATE_LIMIT_TABLE_NAME')
        if not table_name:
            logger.warning("Rate limit table not configured")
            return None
        dynamodb = boto3.resource('dynamodb')
        _dynamodb_table = dynamodb.Table(table_name)
    return _dynamodb_table

def _extract_client_ip(event):
    """Extract client IP from API Gateway event."""
    # Get IP from request context (most reliable)
    ctx = event.get('requestContext', {})
    identity = ctx.get('identity', {})
    ip = identity.get('sourceIp')
    if ip:
        return ip
    
    # Fallback to X-Forwarded-For header
    headers = event.get('headers', {})
    forwarded = headers.get('X-Forwarded-For', headers.get('x-forwarded-for', ''))
    if forwarded:
        return forwarded.split(',')[0].strip()
    
    return 'unknown'

def _determine_limit_tier(event):
    """Determine which rate limit tier applies to this request."""
    method = event.get('httpMethod', 'GET')
    path = event.get('path', '')
    headers = event.get('headers', {})
    
    # Write operations get strictest limits
    if method in ('POST', 'PUT', 'DELETE', 'PATCH'):
        return 'mutation'
    
    # Check for authentication header
    has_auth = bool(headers.get('Authorization') or headers.get('authorization'))
    
    # Security demo endpoints are public
    if '/security-' in path or path.startswith('/security-'):
        return 'public'
    
    # Authenticated requests get higher limits
    if has_auth:
        return 'protected'
    
    return 'public'

def _check_limit(client_ip, tier, max_requests):
    """
    Check if request should be allowed based on rate limit.
    Returns (allowed, remaining, reset_time).
    """
    table = _get_table()
    if not table:
        # No table configured - allow all requests
        now = int(time.time())
        return True, max_requests, now + 60
    
    now = int(time.time())
    window_start = now - 60  # 1 minute sliding window
    
    try:
        # Get current rate limit state
        key = {'client_id': client_ip, 'endpoint': tier}
        result = table.get_item(Key=key)
        
        record = result.get('Item', {})
        count = record.get('request_count', 0)
        last_time = record.get('last_request_time', window_start)
        
        # Reset count if outside current window
        if last_time < window_start:
            count = 0
        else:
            # Apply sliding window decay
            elapsed = now - last_time
            decay_factor = elapsed / 60.0
            count = max(0, count - (max_requests * decay_factor))
        
        # Increment counter
        new_count = count + 1
        allowed = new_count <= max_requests
        remaining = max(0, int(max_requests - new_count))
        
        # Save updated state
        table.put_item(Item={
            'client_id': client_ip,
            'endpoint': tier,
            'request_count': new_count,
            'last_request_time': now,
            'ttl': now + 3600  # Expire after 1 hour
        })
        
        logger.info(f"Rate limit: {client_ip}/{tier} = {new_count}/{max_requests}")
        return allowed, remaining, now + 60
        
    except ClientError as err:
        logger.error(f"DynamoDB error: {err}")
        # Fail open on errors
        return True, max_requests, now + 60
    except Exception as err:
        logger.error(f"Rate limit error: {err}")
        return True, max_requests, now + 60

def check_rate_limit(event):
    """
    Enforce rate limiting on incoming request.
    Returns None if allowed, or 429 response if limit exceeded.
    """
    client_ip = _extract_client_ip(event)
    tier = _determine_limit_tier(event)
    max_requests = LIMITS[tier]
    
    allowed, remaining, reset_time = _check_limit(client_ip, tier, max_requests)
    
    # Store rate info for response headers
    event['_rate_limit'] = {
        'limit': max_requests,
        'remaining': remaining,
        'reset': reset_time
    }
    
    if not allowed:
        logger.warning(f"Rate limit exceeded: {client_ip} on {event.get('path')}")
        return {
            'statusCode': 429,
            'headers': {
                'Content-Type': 'application/json',
                'X-RateLimit-Limit': str(max_requests),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': str(reset_time),
                'Retry-After': '60'
            },
            'body': '{"error":"Too Many Requests","message":"Rate limit exceeded"}'
        }
    
    return None

def add_rate_limit_headers(response, event):
    """Add rate limit headers to successful response."""
    rate_info = event.get('_rate_limit')
    if not rate_info:
        return response
    
    if 'headers' not in response:
        response['headers'] = {}
    
    response['headers']['X-RateLimit-Limit'] = str(rate_info['limit'])
    response['headers']['X-RateLimit-Remaining'] = str(rate_info['remaining'])
    response['headers']['X-RateLimit-Reset'] = str(rate_info['reset'])
    
    return response
