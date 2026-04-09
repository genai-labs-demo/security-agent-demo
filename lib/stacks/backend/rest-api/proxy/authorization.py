"""
Authorization module for role-based access control and field-level security.

Extracts user identity and groups from Cognito JWT claims and implements
field-level filtering of sensitive business metrics based on user role.

Security Controls:
- CWE-862: Missing Authorization - Implements proper authorization checks
- Role-based field filtering for sensitive data
- Least privilege principle: default to restricted access
"""

import logging
from typing import Dict, Any, List, Optional, Set

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Sensitive fields that should be restricted based on role
SENSITIVE_ACCOUNT_FIELDS = {'annualRevenue', 'totalOpportunityValue', 'healthScore'}
SENSITIVE_OPPORTUNITY_FIELDS = {'amount'}  # Restricted for other users' opportunities
SENSITIVE_TEAM_MEMBER_FIELDS = {'quota', 'pipelineValue', 'closedWonValue', 'quotaAttainment', 'winRate'}


class UserContext:
    """
    Container for user authentication and authorization context.
    """
    def __init__(self, user_id: Optional[str] = None, email: Optional[str] = None, 
                 groups: Optional[List[str]] = None):
        self.user_id = user_id
        self.email = email
        self.groups = groups or []
        self.is_admin = 'Admin' in self.groups
        self.is_authenticated = user_id is not None
    
    def __repr__(self):
        return f"UserContext(user_id={self.user_id}, email={self.email}, groups={self.groups}, is_admin={self.is_admin})"


def extract_user_context(event: Dict[str, Any]) -> UserContext:
    """
    Extract user identity and authorization context from API Gateway event.
    
    Reads Cognito JWT claims from requestContext.authorizer.claims to determine:
    - User ID (sub claim)
    - Email address
    - Cognito groups (Admin, Users)
    
    Args:
        event: API Gateway event dictionary
    
    Returns:
        UserContext: User identity and authorization context
    
    Security Note:
        For unauthenticated endpoints (security demos), returns empty context.
        For authenticated endpoints, extracts claims from Cognito JWT.
    """
    try:
        # Extract claims from Cognito JWT in requestContext
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        claims = authorizer.get('claims', {})
        
        if not claims:
            # No claims present - unauthenticated request (security demo endpoints)
            logger.info("No Cognito claims found - unauthenticated request")
            return UserContext()
        
        # Extract user identity from JWT claims
        user_id = claims.get('sub')  # Cognito user ID
        email = claims.get('email')
        
        # Extract Cognito groups from JWT claims
        # Groups are stored in 'cognito:groups' claim as a list
        groups_claim = claims.get('cognito:groups', '')
        if isinstance(groups_claim, str):
            # If groups are comma-separated string, split them
            groups = [g.strip() for g in groups_claim.split(',') if g.strip()]
        elif isinstance(groups_claim, list):
            groups = groups_claim
        else:
            groups = []
        
        user_context = UserContext(user_id=user_id, email=email, groups=groups)
        logger.info(f"Extracted user context: {user_context}")
        return user_context
        
    except Exception as e:
        logger.error(f"Failed to extract user context: {str(e)}")
        # Fail secure: return empty context (no permissions)
        return UserContext()


def filter_sensitive_fields(data: Any, sensitive_fields: Set[str], user_context: UserContext) -> Any:
    """
    Remove sensitive fields from API response based on user authorization.
    
    Implements field-level security by filtering sensitive business metrics
    for non-admin users. Admin users have full access to all data.
    
    Args:
        data: API response data (dict, list, or None)
        sensitive_fields: Set of field names to filter for non-admin users
        user_context: User authorization context
    
    Returns:
        Filtered data with sensitive fields removed for non-admin users
    
    Security Control:
        CWE-862: Implements authorization-based field filtering
        Principle of least privilege: default to filtering sensitive data
    """
    # Admin users have full access - no filtering
    if user_context.is_admin:
        return data
    
    # No data to filter
    if data is None:
        return None
    
    # Filter list of records
    if isinstance(data, list):
        return [filter_sensitive_fields(item, sensitive_fields, user_context) for item in data]
    
    # Filter single record (dictionary)
    if isinstance(data, dict):
        filtered_data = data.copy()
        for field in sensitive_fields:
            if field in filtered_data:
                # Remove sensitive field from response
                filtered_data.pop(field)
                logger.debug(f"Filtered sensitive field '{field}' for non-admin user")
        return filtered_data
    
    # Non-dict, non-list data - return as-is
    return data


def filter_accounts(accounts: Any, user_context: UserContext) -> Any:
    """Filter sensitive account fields for non-admin users."""
    return filter_sensitive_fields(accounts, SENSITIVE_ACCOUNT_FIELDS, user_context)


def filter_opportunities(opportunities: Any, user_context: UserContext) -> Any:
    """Filter sensitive opportunity fields for non-admin users."""
    return filter_sensitive_fields(opportunities, SENSITIVE_OPPORTUNITY_FIELDS, user_context)


def filter_team_members(team_members: Any, user_context: UserContext) -> Any:
    """Filter sensitive team member fields for non-admin users."""
    return filter_sensitive_fields(team_members, SENSITIVE_TEAM_MEMBER_FIELDS, user_context)
