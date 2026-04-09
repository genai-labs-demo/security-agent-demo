"""
Authorization module for role-based access control (RBAC).

This module implements authorization checks for CRM resources based on
AWS Cognito user groups (Admin, Users) and resource ownership.

Security Requirements:
- Admin group: Full access to all resources
- Users group: Can only modify resources they own
- Team member management restricted to Admins only

Addresses: CWE-639 (Authorization Bypass Through User-Controlled Key)
"""

import logging
from typing import Dict, Any, Optional, List

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Cognito group names
ADMIN_GROUP = "Admin"
USERS_GROUP = "Users"


class UserContext:
    """
    Represents the authenticated user's identity and permissions.
    """
    def __init__(self, user_id: str, groups: List[str], email: Optional[str] = None):
        self.user_id = user_id
        self.groups = groups
        self.email = email
        self.is_admin = ADMIN_GROUP in groups
    
    def __repr__(self):
        return f"UserContext(user_id={self.user_id}, groups={self.groups}, is_admin={self.is_admin})"


def extract_user_context(event: Dict[str, Any]) -> Optional[UserContext]:
    """
    Extract user identity and group membership from API Gateway event.
    
    API Gateway includes JWT claims in the requestContext when using
    CognitoUserPoolsAuthorizer.
    
    Args:
        event: API Gateway event dictionary
        
    Returns:
        UserContext object with user_id and groups, or None if not authenticated
    """
    try:
        # Extract claims from API Gateway authorizer context
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        claims = authorizer.get('claims', {})
        
        if not claims:
            logger.warning("No claims found in request context - user not authenticated")
            return None
        
        # Extract user ID (sub claim is the unique Cognito user identifier)
        user_id = claims.get('sub')
        if not user_id:
            logger.warning("No 'sub' claim found in JWT token")
            return None
        
        # Extract email for logging/audit purposes
        email = claims.get('email')
        
        # Extract Cognito groups (comma-separated string or list)
        groups_claim = claims.get('cognito:groups', '')
        if isinstance(groups_claim, str):
            groups = [g.strip() for g in groups_claim.split(',') if g.strip()]
        elif isinstance(groups_claim, list):
            groups = groups_claim
        else:
            groups = []
        
        user_context = UserContext(user_id=user_id, groups=groups, email=email)
        logger.info(f"Extracted user context: {user_context}")
        
        return user_context
        
    except Exception as e:
        logger.error(f"Failed to extract user context: {str(e)}")
        return None


def check_opportunity_access(
    user_context: Optional[UserContext],
    operation: str,
    owner_id: Optional[str] = None
) -> tuple[bool, Optional[str]]:
    """
    Check if user is authorized to perform operation on opportunity.
    
    Authorization Rules:
    - Admin: Full access to all operations
    - Users: 
      - CREATE: Allowed (will own the resource)
      - READ/LIST: Allowed (business requirement for visibility)
      - UPDATE/DELETE: Only if they own the resource (owner_id matches user_id)
    
    Args:
        user_context: Authenticated user context
        operation: Operation type ('list', 'get', 'create', 'update', 'delete')
        owner_id: Resource owner ID (required for update/delete operations)
        
    Returns:
        Tuple of (is_allowed: bool, error_message: Optional[str])
    """
    if not user_context:
        return False, "Authentication required"
    
    # Admins have full access
    if user_context.is_admin:
        logger.info(f"Admin user {user_context.user_id} authorized for {operation} on opportunity")
        return True, None
    
    # Regular users have different permissions based on operation
    if operation in ['list', 'get', 'create']:
        logger.info(f"User {user_context.user_id} authorized for {operation} on opportunity")
        return True, None
    
    # For update/delete, check ownership
    if operation in ['update', 'delete']:
        if owner_id is None:
            return False, "Resource owner not available for authorization check"
        
        if owner_id == user_context.user_id:
            logger.info(f"User {user_context.user_id} authorized to {operation} their own opportunity")
            return True, None
        else:
            logger.warning(
                f"User {user_context.user_id} denied {operation} on opportunity owned by {owner_id}"
            )
            return False, f"Access denied: You can only {operation} opportunities you own"
    
    return False, f"Unsupported operation: {operation}"


def check_account_access(
    user_context: Optional[UserContext],
    operation: str,
    owner_id: Optional[str] = None
) -> tuple[bool, Optional[str]]:
    """
    Check if user is authorized to perform operation on account.
    
    Authorization Rules:
    - Admin: Full access to all operations
    - Users:
      - CREATE: Allowed (will own the resource)
      - READ/LIST: Allowed (business requirement for visibility)
      - UPDATE/DELETE: Only if they own the resource (owner_id matches user_id)
    
    Args:
        user_context: Authenticated user context
        operation: Operation type ('list', 'get', 'create', 'update', 'delete')
        owner_id: Resource owner ID (required for update/delete operations)
        
    Returns:
        Tuple of (is_allowed: bool, error_message: Optional[str])
    """
    if not user_context:
        return False, "Authentication required"
    
    # Admins have full access
    if user_context.is_admin:
        logger.info(f"Admin user {user_context.user_id} authorized for {operation} on account")
        return True, None
    
    # Regular users have different permissions based on operation
    if operation in ['list', 'get', 'create']:
        logger.info(f"User {user_context.user_id} authorized for {operation} on account")
        return True, None
    
    # For update/delete, check ownership
    if operation in ['update', 'delete']:
        if owner_id is None:
            return False, "Resource owner not available for authorization check"
        
        if owner_id == user_context.user_id:
            logger.info(f"User {user_context.user_id} authorized to {operation} their own account")
            return True, None
        else:
            logger.warning(
                f"User {user_context.user_id} denied {operation} on account owned by {owner_id}"
            )
            return False, f"Access denied: You can only {operation} accounts you own"
    
    return False, f"Unsupported operation: {operation}"


def check_team_member_access(
    user_context: Optional[UserContext],
    operation: str
) -> tuple[bool, Optional[str]]:
    """
    Check if user is authorized to perform operation on team members.
    
    Authorization Rules:
    - Admin: Full access to all operations
    - Users: READ only (need to see team members for assignments)
    
    Args:
        user_context: Authenticated user context
        operation: Operation type ('list', 'get', 'create', 'update', 'delete')
        
    Returns:
        Tuple of (is_allowed: bool, error_message: Optional[str])
    """
    if not user_context:
        return False, "Authentication required"
    
    # Admins have full access
    if user_context.is_admin:
        logger.info(f"Admin user {user_context.user_id} authorized for {operation} on team member")
        return True, None
    
    # Regular users can only read team members
    if operation in ['list', 'get']:
        logger.info(f"User {user_context.user_id} authorized to {operation} team members")
        return True, None
    
    # Deny create, update, delete for regular users
    logger.warning(
        f"User {user_context.user_id} denied {operation} on team member - Admin only operation"
    )
    return False, "Access denied: Only administrators can manage team members"
