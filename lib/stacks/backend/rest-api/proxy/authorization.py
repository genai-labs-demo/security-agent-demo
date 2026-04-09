"""
Authorization module for enforcing role-based access control (RBAC).

This module extracts JWT claims from API Gateway events and provides
authorization helpers to enforce permission checks before sensitive operations.

Security Controls:
- Extracts user identity and group memberships from JWT claims
- Enforces Admin-only access for team member management
- Enforces ownership checks for opportunity modifications
- Implements fail-secure defaults (deny by default)
"""

import logging
from typing import Dict, Any, List, Optional

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


class AuthorizationError(Exception):
    """Exception raised when a user is not authorized to perform an operation."""
    pass


class UserContext:
    """
    Container for authenticated user information extracted from JWT claims.
    """
    def __init__(
        self,
        user_id: str,
        email: str,
        username: str,
        groups: List[str]
    ):
        self.user_id = user_id
        self.email = email
        self.username = username
        self.groups = groups
    
    def is_admin(self) -> bool:
        """Check if user is a member of the Admin group."""
        return "Admin" in self.groups
    
    def __repr__(self):
        return (f"UserContext(user_id={self.user_id}, email={self.email}, "
                f"username={self.username}, groups={self.groups})")


def extract_user_context(event: Dict[str, Any]) -> Optional[UserContext]:
    """
    Extract user context from API Gateway event authorizer context.
    
    API Gateway populates requestContext.authorizer.claims with JWT claims
    when using Cognito User Pool Authorizer.
    
    Args:
        event: API Gateway event dictionary
    
    Returns:
        UserContext object with user information, or None if not authenticated
    
    JWT Claims Structure (from Cognito):
        - sub: User ID (UUID)
        - email: User email address
        - cognito:username: Username
        - cognito:groups: Comma-separated list of groups (Admin, Users)
    """
    try:
        # Extract claims from API Gateway authorizer context
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        claims = authorizer.get('claims', {})
        
        # If no claims found, this is an unauthenticated request
        if not claims:
            logger.info("No JWT claims found - unauthenticated request")
            return None
        
        # Extract required claims
        user_id = claims.get('sub')
        email = claims.get('email')
        username = claims.get('cognito:username')
        
        # Extract group memberships
        # Cognito can provide groups in multiple formats:
        # 1. cognito:groups as comma-separated string
        # 2. cognito:groups as list
        groups_claim = claims.get('cognito:groups', '')
        if isinstance(groups_claim, str):
            groups = [g.strip() for g in groups_claim.split(',') if g.strip()]
        elif isinstance(groups_claim, list):
            groups = groups_claim
        else:
            groups = []
        
        if not user_id or not email:
            logger.warning("JWT claims missing required fields (sub or email)")
            return None
        
        user_context = UserContext(
            user_id=user_id,
            email=email,
            username=username or email,
            groups=groups
        )
        
        logger.info(f"Extracted user context: {user_context}")
        return user_context
        
    except Exception as e:
        logger.error(f"Failed to extract user context: {str(e)}")
        return None


def require_admin(user_context: Optional[UserContext]) -> None:
    """
    Verify that the user has Admin privileges.
    
    Args:
        user_context: User context extracted from JWT claims
    
    Raises:
        AuthorizationError: If user is not authenticated or not an Admin
    """
    if user_context is None:
        logger.warning("Authorization check failed: No user context (unauthenticated)")
        raise AuthorizationError("Authentication required")
    
    if not user_context.is_admin():
        logger.warning(
            f"Authorization check failed: User {user_context.email} "
            f"is not an Admin (groups: {user_context.groups})"
        )
        raise AuthorizationError("Admin privileges required")
    
    logger.info(f"Authorization check passed: User {user_context.email} is Admin")


def require_admin_or_owner(user_context: Optional[UserContext], owner_id: str) -> None:
    """
    Verify that the user is either an Admin or the owner of the resource.
    
    Args:
        user_context: User context extracted from JWT claims
        owner_id: ID of the resource owner
    
    Raises:
        AuthorizationError: If user is not authenticated, not an Admin, and not the owner
    """
    if user_context is None:
        logger.warning("Authorization check failed: No user context (unauthenticated)")
        raise AuthorizationError("Authentication required")
    
    if user_context.is_admin():
        logger.info(f"Authorization check passed: User {user_context.email} is Admin")
        return
    
    # For owner check, we need to match the user_id from JWT with the owner_id
    # Note: Cognito user pool ID (sub claim) may differ from team_member ID
    # This is a simplified check - production systems should maintain a mapping
    if user_context.user_id == owner_id or user_context.email == owner_id:
        logger.info(f"Authorization check passed: User {user_context.email} is the owner")
        return
    
    logger.warning(
        f"Authorization check failed: User {user_context.email} "
        f"is not Admin and does not own resource (owner_id: {owner_id})"
    )
    raise AuthorizationError("Admin privileges or resource ownership required")
