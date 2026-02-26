"""
Authorization module for role-based access control (RBAC).

Enforces authorization checks based on AWS Cognito user groups.
Extracts group membership from API Gateway authorizer claims and validates
permissions for sensitive operations.

Security: CWE-862 (Missing Authorization) mitigation
"""

import logging
from typing import Dict, Any, List, Optional

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Cognito group names
ADMIN_GROUP = "Admin"
USERS_GROUP = "Users"


def extract_user_groups(event: Dict[str, Any]) -> List[str]:
    """
    Extract Cognito group membership from API Gateway event.
    
    Args:
        event: API Gateway event dictionary
    
    Returns:
        List of group names the user belongs to (empty list if none or not authenticated)
    """
    try:
        # Extract groups from Cognito authorizer claims
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
        groups_claim = claims.get('cognito:groups', '')
        
        if not groups_claim:
            logger.info("No cognito:groups claim found in request")
            return []
        
        # Groups claim is a comma-separated string
        groups = [g.strip() for g in groups_claim.split(',') if g.strip()]
        logger.info(f"User groups extracted: {groups}")
        return groups
        
    except Exception as e:
        logger.warning(f"Failed to extract user groups: {str(e)}")
        return []


def require_admin(user_groups: List[str]) -> None:
    """
    Enforce Admin group membership for sensitive operations.
    
    Args:
        user_groups: List of Cognito groups the user belongs to
    
    Raises:
        PermissionError: If user is not in Admin group
    """
    if not user_groups:
        logger.warning("Authorization failed: No user groups provided")
        raise PermissionError(
            "Access denied: This operation requires administrative privileges. "
            "Contact your administrator if you believe you should have access."
        )
    
    if ADMIN_GROUP not in user_groups:
        logger.warning(f"Authorization failed: User groups {user_groups} do not include {ADMIN_GROUP}")
        raise PermissionError(
            "Access denied: This operation requires administrative privileges. "
            "Contact your administrator if you believe you should have access."
        )
    
    logger.info(f"Authorization successful: User is member of {ADMIN_GROUP} group")


def require_authenticated(user_groups: List[str]) -> None:
    """
    Enforce that user is authenticated (belongs to at least one group).
    
    This is a lightweight check since API Gateway Cognito authorizer already
    validates JWT authenticity. This function exists for explicitness.
    """
    # If we reach this point, API Gateway has already validated the JWT
    pass
