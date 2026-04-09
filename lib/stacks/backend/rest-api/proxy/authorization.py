"""
Authorization module for resource-level access control.
Implements ownership-based authorization checks to prevent BOLA/IDOR vulnerabilities.
"""

import logging
from typing import Dict, Any, Optional

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


class AuthorizationError(Exception):
    """Raised when a user attempts to access a resource they don't own."""
    pass


def check_resource_authorization(
    resource: Optional[Dict[str, Any]],
    user_id: str,
    resource_type: str,
    resource_id: str
) -> None:
    """
    Verify that the authenticated user has permission to access the resource.
    
    Implements resource-level authorization by checking if the resource's owner_id
    matches the authenticated user's ID from the JWT token.
    
    This prevents Broken Object Level Authorization (BOLA/IDOR) vulnerabilities
    where an authenticated user could access another user's resources by manipulating
    the resource ID in the request.
    
    Args:
        resource: The resource dictionary retrieved from the database (must contain 'ownerId')
        user_id: The authenticated user's ID from JWT token claims (sub)
        resource_type: Type of resource being accessed (e.g., 'account', 'opportunity')
        resource_id: ID of the resource being accessed
    
    Raises:
        AuthorizationError: If the user does not own the resource
    
    Security: CWE-639 Authorization Bypass Through User-Controlled Key
    """
    if resource is None:
        # Resource doesn't exist - let the caller handle 404
        return
    
    resource_owner_id = resource.get('ownerId')
    
    if not resource_owner_id:
        logger.warning(f"Resource {resource_type} {resource_id} has no owner_id - denying access")
        raise AuthorizationError(
            f"Access denied: {resource_type} does not have an owner assigned"
        )
    
    if resource_owner_id != user_id:
        logger.warning(
            f"Authorization failed: user {user_id} attempted to access "
            f"{resource_type} {resource_id} owned by {resource_owner_id}"
        )
        raise AuthorizationError(f"Access denied: you do not have permission to access this {resource_type}")
