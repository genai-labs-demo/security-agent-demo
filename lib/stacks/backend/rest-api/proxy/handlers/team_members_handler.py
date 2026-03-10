"""
Team members handler module for CRUD operations on team member entities.
Handles database operations and field mapping between snake_case and camelCase.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def _map_team_member_to_api_format(db_record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map database snake_case columns to camelCase API response fields.
    
    Args:
        db_record: Database record with snake_case column names
    
    Returns:
        Dictionary with camelCase field names for API response
    """
    return {
        'id': db_record.get('id'),
        'name': db_record.get('name'),
        'email': db_record.get('email'),
        'role': db_record.get('role'),
        'quota': float(db_record.get('quota')) if db_record.get('quota') is not None else None,
        'pipelineValue': float(db_record.get('pipeline_value')) if db_record.get('pipeline_value') is not None else None,
        'closedWonValue': float(db_record.get('closed_won_value')) if db_record.get('closed_won_value') is not None else None,
        'quotaAttainment': float(db_record.get('quota_attainment')) if db_record.get('quota_attainment') is not None else None,
        'winRate': float(db_record.get('win_rate')) if db_record.get('win_rate') is not None else None,
        'opportunityCount': db_record.get('opportunity_count'),
        'avatarUrl': db_record.get('avatar_url')
    }


def _map_api_to_db_format(api_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map camelCase API fields to snake_case database columns.
    
    Args:
        api_data: API request data with camelCase field names
    
    Returns:
        Dictionary with snake_case column names for database operations
    """
    db_data = {}
    
    # Map fields if they exist in the input
    field_mapping = {
        'name': 'name',
        'email': 'email',
        'role': 'role',
        'quota': 'quota',
        'pipelineValue': 'pipeline_value',
        'closedWonValue': 'closed_won_value',
        'quotaAttainment': 'quota_attainment',
        'winRate': 'win_rate',
        'opportunityCount': 'opportunity_count',
        'avatarUrl': 'avatar_url'
    }
    
    for api_field, db_field in field_mapping.items():
        if api_field in api_data:
            db_data[db_field] = api_data[api_field]
    
    return db_data


def list_team_members(connection) -> List[Dict[str, Any]]:
    """
    Query all team members from the database ordered by name.
    
    Args:
        connection: Database connection object
    
    Returns:
        List of team member dictionaries in API format
    
    Raises:
        Exception: If database query fails
    """
    try:
        logger.info("Listing all team members")
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                id, name, email, role, quota, pipeline_value, closed_won_value,
                quota_attainment, win_rate, opportunity_count, avatar_url
            FROM team_members
            ORDER BY name ASC
        """
        
        cursor.execute(query)
        records = cursor.fetchall()
        cursor.close()
        
        # Map to API format
        team_members = [_map_team_member_to_api_format(dict(record)) for record in records]
        
        logger.info(f"Retrieved {len(team_members)} team members")
        return team_members
        
    except psycopg2.Error as e:
        logger.error(f"Database error listing team members: {str(e)}")
        raise Exception(f"Failed to list team members: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error listing team members: {str(e)}")
        raise


def get_team_member(connection, member_id: str) -> Optional[Dict[str, Any]]:
    """
    Query a single team member by ID from the database.
    
    Args:
        connection: Database connection object
        member_id: Team member ID to retrieve
    
    Returns:
        Team member dictionary in API format, or None if not found
    
    Raises:
        Exception: If database query fails
    """
    try:
        logger.info(f"Getting team member with ID: {member_id}")
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                id, name, email, role, quota, pipeline_value, closed_won_value,
                quota_attainment, win_rate, opportunity_count, avatar_url
            FROM team_members
            WHERE id = %s
        """
        
        cursor.execute(query, (member_id,))
        record = cursor.fetchone()
        cursor.close()
        
        if not record:
            logger.info(f"Team member not found: {member_id}")
            return None
        
        # Map to API format
        team_member = _map_team_member_to_api_format(dict(record))
        
        logger.info(f"Retrieved team member: {member_id}")
        return team_member
        
    except psycopg2.Error as e:
        logger.error(f"Database error getting team member {member_id}: {str(e)}")
        raise Exception(f"Failed to get team member: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error getting team member {member_id}: {str(e)}")
        raise


def create_team_member(connection, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Insert a new team member record into the database.
    Validates email uniqueness before insertion.
    
    Args:
        connection: Database connection object
        data: Team member data in API format (camelCase)
    
    Returns:
        Created team member dictionary in API format
    
    Raises:
        Exception: If database insert fails or validation fails
    """
    try:
        logger.info(f"Creating new team member: {data.get('name')}")
        
        # Map API format to database format
        db_data = _map_api_to_db_format(data)
        
        # Generate ID if not provided
        if 'id' not in data:
            import uuid
            db_data['id'] = str(uuid.uuid4())
        else:
            db_data['id'] = data['id']
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        # Validate email uniqueness
        if 'email' in db_data and db_data['email']:
            cursor.execute(
                "SELECT id FROM team_members WHERE email = %s",
                (db_data['email'],)
            )
            if cursor.fetchone():
                cursor.close()
                raise Exception(f"Email already exists: {db_data['email']}")
        
        # Build INSERT query dynamically based on provided fields
        columns = list(db_data.keys())
        placeholders = ['%s'] * len(columns)
        values = [db_data[col] for col in columns]
        
        query = f"""
            INSERT INTO team_members ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
            RETURNING 
                id, name, email, role, quota, pipeline_value, closed_won_value,
                quota_attainment, win_rate, opportunity_count, avatar_url
        """
        
        cursor.execute(query, values)
        record = cursor.fetchone()
        connection.commit()
        cursor.close()
        
        # Map to API format
        team_member = _map_team_member_to_api_format(dict(record))
        
        logger.info(f"Created team member with ID: {team_member['id']}")
        return team_member
        
    except psycopg2.IntegrityError as e:
        connection.rollback()
        logger.error(f"Integrity error creating team member: {str(e)}")
        # Check for unique constraint violation on email
        if 'unique' in str(e).lower() and 'email' in str(e).lower():
            raise Exception(f"Email already exists")
        raise Exception(f"Failed to create team member: constraint violation")
    except psycopg2.Error as e:
        connection.rollback()
        logger.error(f"Database error creating team member: {str(e)}")
        raise Exception(f"Failed to create team member: {str(e)}")
    except Exception as e:
        connection.rollback()
        # Re-raise if it's already our custom exception
        if "Email already exists" in str(e):
            raise
        logger.error(f"Unexpected error creating team member: {str(e)}")
        raise


def _get_authenticated_user_email(event: Dict[str, Any]) -> Optional[str]:
    """
    Extract the authenticated user's email from Cognito JWT claims in API Gateway event.
    
    Args:
        event: API Gateway event dictionary containing requestContext
    
    Returns:
        User email from Cognito claims, or None if not found
    """
    try:
        # Extract Cognito claims from API Gateway event
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        claims = authorizer.get('claims', {})
        email = claims.get('email')
        
        if email:
            logger.info(f"Authenticated user email: {email}")
            return email
        else:
            logger.warning("No email found in Cognito claims")
            return None
    except Exception as e:
        logger.error(f"Failed to extract user email from event: {str(e)}")
        return None


def _get_team_member_id_by_email(connection, email: str) -> Optional[str]:
    """
    Look up team member ID by email address.
    
    Args:
        connection: Database connection object
        email: Email address to look up
    
    Returns:
        Team member ID if found, None otherwise
    """
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT id FROM team_members WHERE email = %s", (email,))
        result = cursor.fetchone()
        cursor.close()
        
        if result:
            return result[0]
        return None
    except Exception as e:
        logger.error(f"Failed to look up team member by email: {str(e)}")
        return None


def update_team_member(connection, member_id: str, data: Dict[str, Any], event: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
    """
    Update an existing team member record in the database.
    Validates email uniqueness if email is being updated. 
    Enforces authorization: users can only update their own records and cannot modify role field.
    
    Args:
        connection: Database connection object
        member_id: Team member ID to update
        data: Partial team member data in API format (camelCase)
        event: API Gateway event (required for authorization checks)
    
    Returns:
        Updated team member dictionary in API format, or None if not found
    
    Raises:
        Exception: If database update fails, validation fails, or authorization is denied
    """
    try:
        logger.info(f"Updating team member: {member_id}")
        
        # Authorization Check 1: Reject role modifications
        # The 'role' field is a security-sensitive attribute that controls access privileges
        # Allowing arbitrary role modifications would enable privilege escalation attacks
        if 'role' in data:
            logger.warning(f"Attempted role modification blocked for team member: {member_id}")
            raise Exception("Forbidden: Role modifications are not allowed")
        
        # Authorization Check 2: Verify user is updating their own record
        # Extract authenticated user's email from Cognito JWT claims
        if event:
            user_email = _get_authenticated_user_email(event)
            if user_email:
                # Look up the authenticated user's team member ID
                authenticated_member_id = _get_team_member_id_by_email(connection, user_email)
                
                if not authenticated_member_id:
                    logger.warning(f"Authenticated user {user_email} has no team member record")
                    raise Exception("Forbidden: User not found in team members")
                
                # Verify user is updating their own record (not someone else's)
                if authenticated_member_id != member_id:
                    logger.warning(
                        f"Authorization denied: User {user_email} (ID: {authenticated_member_id}) "
                        f"attempted to update team member {member_id}"
                    )
                    raise Exception("Forbidden: You can only update your own team member record")
            else:
                # No user context available - deny the update
                logger.warning(f"No authentication context provided for team member update: {member_id}")
                raise Exception("Forbidden: Authentication required")
        else:
            # No event provided - deny the update for security
            logger.warning(f"No event context provided for authorization check: {member_id}")
            raise Exception("Forbidden: Authorization context required")
        
        # Map API format to database format
        db_data = _map_api_to_db_format(data)
        
        # Remove id if present (shouldn't be updated)
        db_data.pop('id', None)
        
        if not db_data:
            logger.warning("No fields to update")
            # Return current team member
            return get_team_member(connection, member_id)
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        # Validate email uniqueness if being updated
        if 'email' in db_data and db_data['email']:
            cursor.execute(
                "SELECT id FROM team_members WHERE email = %s AND id != %s",
                (db_data['email'], member_id)
            )
            if cursor.fetchone():
                cursor.close()
                raise Exception(f"Email already exists: {db_data['email']}")
        
        # Build UPDATE query dynamically based on provided fields
        set_clauses = [f"{col} = %s" for col in db_data.keys()]
        values = list(db_data.values())
        values.append(member_id)  # For WHERE clause
        
        query = f"""
            UPDATE team_members
            SET {', '.join(set_clauses)}
            WHERE id = %s
            RETURNING 
                id, name, email, role, quota, pipeline_value, closed_won_value,
                quota_attainment, win_rate, opportunity_count, avatar_url
        """
        
        cursor.execute(query, values)
        record = cursor.fetchone()
        
        if not record:
            connection.rollback()
            cursor.close()
            logger.info(f"Team member not found for update: {member_id}")
            return None
        
        connection.commit()
        cursor.close()
        
        # Map to API format
        team_member = _map_team_member_to_api_format(dict(record))
        
        logger.info(f"Updated team member: {member_id}")
        return team_member
        
    except psycopg2.IntegrityError as e:
        connection.rollback()
        logger.error(f"Integrity error updating team member {member_id}: {str(e)}")
        # Check for unique constraint violation on email
        if 'unique' in str(e).lower() and 'email' in str(e).lower():
            raise Exception(f"Email already exists")
        raise Exception(f"Failed to update team member: constraint violation")
    except psycopg2.Error as e:
        connection.rollback()
        logger.error(f"Database error updating team member {member_id}: {str(e)}")
        raise Exception(f"Failed to update team member: {str(e)}")
    except Exception as e:
        connection.rollback()
        # Re-raise if it's already our custom exception
        if "Email already exists" in str(e):
            raise
        logger.error(f"Unexpected error updating team member {member_id}: {str(e)}")
        raise


def delete_team_member(connection, member_id: str) -> bool:
    """
    Delete a team member record from the database.
    Checks for foreign key constraints (owned accounts/opportunities) before deletion.
    
    Args:
        connection: Database connection object
        member_id: Team member ID to delete
    
    Returns:
        True if team member was deleted, False if not found
    
    Raises:
        Exception: If team member owns accounts or opportunities, or database delete fails
    """
    try:
        logger.info(f"Deleting team member: {member_id}")
        
        cursor = connection.cursor()
        
        # Check if team member exists
        cursor.execute("SELECT id FROM team_members WHERE id = %s", (member_id,))
        if not cursor.fetchone():
            cursor.close()
            logger.info(f"Team member not found for deletion: {member_id}")
            return False
        
        # Check for owned accounts (foreign key constraint)
        cursor.execute(
            "SELECT COUNT(*) as count FROM accounts WHERE owner_id = %s",
            (member_id,)
        )
        result = cursor.fetchone()
        account_count = result[0] if result else 0
        
        # Check for owned opportunities (foreign key constraint)
        cursor.execute(
            "SELECT COUNT(*) as count FROM opportunities WHERE owner_id = %s",
            (member_id,)
        )
        result = cursor.fetchone()
        opportunity_count = result[0] if result else 0
        
        if account_count > 0 or opportunity_count > 0:
            cursor.close()
            error_parts = []
            if account_count > 0:
                error_parts.append(f"{account_count} account(s)")
            if opportunity_count > 0:
                error_parts.append(f"{opportunity_count} opportunity(ies)")
            
            logger.warning(
                f"Cannot delete team member {member_id}: owns {', '.join(error_parts)}"
            )
            raise Exception(
                f"Cannot delete team member: owns {', '.join(error_parts)}. "
                f"Reassign ownership first."
            )
        
        # Delete the team member
        cursor.execute("DELETE FROM team_members WHERE id = %s", (member_id,))
        connection.commit()
        cursor.close()
        
        logger.info(f"Deleted team member: {member_id}")
        return True
        
    except psycopg2.IntegrityError as e:
        connection.rollback()
        logger.error(f"Integrity error deleting team member {member_id}: {str(e)}")
        raise Exception(f"Cannot delete team member: has associated records")
    except psycopg2.Error as e:
        connection.rollback()
        logger.error(f"Database error deleting team member {member_id}: {str(e)}")
        raise Exception(f"Failed to delete team member: {str(e)}")
    except Exception as e:
        connection.rollback()
        # Re-raise if it's already our custom exception
        if "Cannot delete team member" in str(e):
            raise
        logger.error(f"Unexpected error deleting team member {member_id}: {str(e)}")
        raise
