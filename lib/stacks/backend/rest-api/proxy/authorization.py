"""
Authorization module for enforcing ownership-based access control.

This module provides utilities to validate that authenticated users
have permission to access or modify resources based on ownership.

Implements protection against Broken Object Level Authorization (BOPLA)
vulnerabilities (CWE-639).
"""

import logging
from typing import Optional, Dict, Any

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


class AuthorizationError(Exception):
    """Exception raised when user is not authorized to access a resource."""
    pass


def validate_resource_ownership(
    resource: Optional[Dict[str, Any]],
    authenticated_user_id: Optional[str],
    resource_type: str,
    resource_id: str
) -> None:
    """
    Validate that the authenticated user owns the requested resource.
    
    Args:
        resource: The resource dictionary (must contain 'ownerId' field)
        authenticated_user_id: The authenticated user's ID from JWT token
        resource_type: Type of resource (e.g., 'opportunity', 'account')
        resource_id: ID of the resource being accessed
    
    Raises:
        AuthorizationError: If user is not authorized to access the resource
    """
    if not authenticated_user_id:
        logger.warning(f"Authorization check failed: No authenticated user for {resource_type} {resource_id}")
        raise AuthorizationError("Authentication required to access this resource")
    
    if not resource:
        # Resource not found - will be handled by caller
        return
    
    resource_owner_id = resource.get('ownerId')
    if resource_owner_id != authenticated_user_id:
        logger.warning(f"Authorization failed: User {authenticated_user_id} attempted to access {resource_type} {resource_id} owned by {resource_owner_id}")
        raise AuthorizationError(f"You do not have permission to access this {resource_type}")
