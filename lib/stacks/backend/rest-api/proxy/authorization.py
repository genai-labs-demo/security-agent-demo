"""
Authorization module for user-based access control.

Extracts user identity from JWT token claims in API Gateway request context
and provides authorization checks for resource ownership.

Addresses CWE-639: Authorization Bypass Through User-Controlled Key
"""

import logging
from typing import Dict, Any, Optional

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


class AuthorizationError(Exception):
    """Raised when a user is not authorized to access a resource."""
    pass


def extract_user_id_from_event(event: Dict[str, Any]) -> Optional[str]:
    """
    Extract the authenticated user's ID from the API Gateway event.
    
    When API Gateway validates a Cognito JWT token, it adds the token claims
    to event['requestContext']['authorizer']['claims']. This function extracts
    the user's unique identifier (sub claim) from these claims.
    
    Args:
        event: API Gateway event dictionary
    
    Returns:
        User ID (sub claim from JWT) or None if not authenticated
    
    Example:
        event['requestContext']['authorizer']['claims']['sub'] = 'user-123'
        Returns: 'user-123'
    """
    try:
        # Extract claims from Cognito authorizer
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        claims = authorizer.get('claims', {})
        
        # The 'sub' claim is the unique user identifier in Cognito
        user_id = claims.get('sub')
        
        if user_id:
            logger.info(f"Extracted user ID from JWT: {user_id}")
            return user_id
        else:
            logger.warning("No user ID found in JWT claims")
            return None
            
    except Exception as e:
        logger.error(f"Failed to extract user ID from event: {str(e)}")
        return None


def extract_username_from_event(event: Dict[str, Any]) -> Optional[str]:
    """
    Extract the authenticated user's username from the API Gateway event.
    
    Args:
        event: API Gateway event dictionary
    
    Returns:
        Username (cognito:username claim) or None if not available
    """
    try:
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        claims = authorizer.get('claims', {})
        
        # Try cognito:username first, fall back to email or sub
        username = claims.get('cognito:username') or claims.get('email') or claims.get('sub')
        
        if username:
            logger.info(f"Extracted username from JWT: {username}")
        
        return username
            
    except Exception as e:
        logger.error(f"Failed to extract username from event: {str(e)}")
        return None


def validate_resource_ownership(resource: Dict[str, Any], user_id: str, resource_type: str, resource_id: str) -> None:
    """
    Validate that the current user owns the specified resource.
    
    Args:
        resource: Resource dictionary containing ownerId field
        user_id: Current authenticated user's ID
        resource_type: Type of resource (e.g., 'opportunity', 'account')
        resource_id: ID of the resource being accessed
    
    Raises:
        AuthorizationError: If user does not own the resource
    """
    owner_id = resource.get('ownerId')
    
    if not owner_id:
        logger.warning(f"{resource_type} {resource_id} has no owner - access denied")
        raise AuthorizationError(
            f"Access denied: {resource_type} has no owner assigned"
        )
    
    if owner_id != user_id:
        logger.warning(
            f"Authorization failed: user {user_id} attempted to access "
            f"{resource_type} {resource_id} owned by {owner_id}"
        )
        raise AuthorizationError(
            f"Access denied: You do not have permission to access this {resource_type}"
        )
    
    logger.info(f"Authorization successful: user {user_id} owns {resource_type} {resource_id}")
