"""
Authorization module for resource-level access control.
Implements ownership validation and user identity extraction from API Gateway Cognito authorizer.

This module provides functions to:
1. Extract authenticated user identity from API Gateway event context
2. Validate resource ownership before allowing access or modifications
3. Raise appropriate authorization errors for access denial

Security: CWE-639 (Authorization Bypass Through User-Controlled Key)
"""

import logging
from typing import Dict, Any, Optional

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


class AuthorizationError(Exception):
    """
    Raised when user is not authorized to access or modify a resource.
    This should result in HTTP 403 Forbidden response.
    """
    pass


def extract_user_identity(event: Dict[str, Any]) -> str:
    """
    Extract authenticated user ID from API Gateway event.
    
    When API Gateway uses Cognito authorizer, it populates the requestContext
    with claims from the JWT token. This function extracts the unique user identifier.
    
    Args:
        event: API Gateway event dictionary with requestContext
    
    Returns:
        User ID (Cognito 'sub' claim or 'cognito:username')
    
    Raises:
        AuthorizationError: If user identity cannot be extracted (missing or invalid auth)
    
    Example event structure:
        {
            "requestContext": {
                "authorizer": {
                    "claims": {
                        "sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                        "cognito:username": "user@example.com",
                        "email": "user@example.com"
                    }
                }
            }
        }
    """
    try:
        # Extract claims from Cognito authorizer
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
        
        # Prefer 'sub' (subject) claim as it's the unique user identifier
        user_id = claims.get('sub') or claims.get('cognito:username')
        
        if not user_id:
            logger.error("Failed to extract user identity from event: no sub or cognito:username claim found")
            raise AuthorizationError("User identity not found in request context")
        
        logger.info(f"Extracted user identity: {user_id}")
        return user_id
        
    except Exception as e:
        logger.error(f"Error extracting user identity: {str(e)}")
        raise AuthorizationError("Failed to authenticate user")


def validate_resource_ownership(resource: Optional[Dict[str, Any]], user_id: str, resource_type: str = "resource") -> None:
    """
    Validate that the resource is owned by the requesting user.
    
    Args:
        resource: Resource dictionary (must contain 'ownerId' field)
        user_id: Authenticated user ID
        resource_type: Type of resource for error messages (e.g., "account", "opportunity")
    
    Raises:
        AuthorizationError: If resource is None or not owned by user
    """
    if resource is None:
        raise AuthorizationError(f"{resource_type.capitalize()} not found or access denied")
    
    resource_owner = resource.get('ownerId')
    if resource_owner != user_id:
        logger.warning(f"Authorization denied: user {user_id} attempted to access {resource_type} owned by {resource_owner}")
        raise AuthorizationError(f"You do not have permission to access this {resource_type}")
