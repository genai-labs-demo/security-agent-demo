"""
Authorization module for enforcing role-based access control (RBAC).

This module extracts user identity and group membership from Cognito JWT claims
and enforces authorization policies based on user groups (Admin vs Users).

Security: Implements CWE-862 (Missing Authorization) mitigation by checking
cognito:groups claim before allowing access to protected operations.
"""

import logging
from typing import Dict, Any, List, Optional

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


class UnauthorizedException(Exception):
    """Exception raised when user is not authorized for the requested operation."""
    pass


class UserContext:
    """
    User context extracted from Cognito JWT token claims.
    
    Attributes:
        user_id: Cognito username/sub claim
        email: User's email address
        groups: List of Cognito groups user belongs to (e.g., ['Admin'], ['Users'])
    """
    
    def __init__(self, user_id: str, email: Optional[str], groups: List[str]):
        self.user_id = user_id
        self.email = email
        self.groups = groups or []
    
    def is_admin(self) -> bool:
        """Check if user belongs to Admin group."""
        return "Admin" in self.groups
    
    def is_user(self) -> bool:
        """Check if user belongs to Users group."""
        return "Users" in self.groups
    
    def __repr__(self):
        return f"UserContext(user_id={self.user_id}, email={self.email}, groups={self.groups})"


def extract_user_context(event: Dict[str, Any]) -> Optional[UserContext]:
    """
    Extract user context from API Gateway event.
    
    When API Gateway uses Cognito User Pools authorizer, it populates
    event['requestContext']['authorizer']['claims'] with JWT token claims.
    
    Args:
        event: API Gateway event dictionary
        
    Returns:
        UserContext object with user identity and groups, or None if not authenticated
    """
    try:
        # Extract claims from API Gateway authorizer context
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        claims = authorizer.get('claims', {})
        
        if not claims:
            logger.warning("No authorizer claims found in request context")
            return None
        
        # Extract user identity
        # Cognito uses 'sub' claim for unique user ID and 'cognito:username' for username
        user_id = claims.get('cognito:username') or claims.get('sub') or claims.get('username')
        email = claims.get('email')
        
        # Extract groups from cognito:groups claim
        # This can be a string (single group) or comma-separated list
        groups_claim = claims.get('cognito:groups', '')
        if isinstance(groups_claim, str):
            groups = [g.strip() for g in groups_claim.split(',') if g.strip()] if groups_claim else []
        elif isinstance(groups_claim, list):
            groups = groups_claim
        else:
            groups = []
        
        user_context = UserContext(user_id=user_id, email=email, groups=groups)
        logger.info(f"Extracted user context: {user_context}")
        
        return user_context
        
    except Exception as e:
        logger.error(f"Failed to extract user context: {str(e)}")
        return None


def check_authorization(
    user_context: Optional[UserContext],
    resource_type: str,
    operation: str
) -> None:
    """
    Check if user is authorized to perform operation on resource type.
    
    Authorization Rules:
    - Admin group: Full access to all resources and operations
    - Users group: Read access to most resources, limited write access
    - No group or unauthenticated: Deny all access to protected resources
    
    Args:
        user_context: User context with identity and groups
        resource_type: Resource type (accounts, opportunities, team-members, industries)
        operation: Operation type (list, get, create, update, delete)
        
    Raises:
        UnauthorizedException: If user is not authorized for the operation
    """
    # Security endpoints are handled separately (no auth required)
    if resource_type.startswith('security-'):
        return
    
    # If no user context, deny access (authentication required)
    if not user_context:
        logger.warning(f"Authorization denied: No user context for {operation} on {resource_type}")
        raise UnauthorizedException(
            "Authentication required. Please provide a valid authorization token."
        )
    
    # Admin group has full access to all resources
    if user_context.is_admin():
        logger.info(f"Authorization granted: Admin user {user_context.user_id} performing {operation} on {resource_type}")
        return
    
    # Users group has limited access
    if user_context.is_user():
        # Define allowed operations for Users group
        allowed_operations = {
            'accounts': ['list', 'get'],
            'opportunities': ['list', 'get', 'create', 'update', 'delete'],
            'team-members': ['list', 'get'],
            'industries': ['list', 'get']
        }
        
        allowed = allowed_operations.get(resource_type, [])
        
        if operation in allowed:
            logger.info(f"Authorization granted: User {user_context.user_id} performing {operation} on {resource_type}")
            return
        else:
            logger.warning(f"Authorization denied: User {user_context.user_id} attempted {operation} on {resource_type}")
            raise UnauthorizedException(
                f"Insufficient permissions. The '{operation}' operation on '{resource_type}' requires Admin group membership."
            )
    
    # User has no recognized group membership - deny access
    logger.warning(f"Authorization denied: User {user_context.user_id} has no valid group membership for {operation} on {resource_type}")
    raise UnauthorizedException(
        "Insufficient permissions. You must be a member of Admin or Users group to access this resource."
    )
