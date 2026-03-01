"""
Accounts handler module for CRUD operations on account entities.
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


def _map_account_to_api_format(db_record: Dict[str, Any]) -> Dict[str, Any]:
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
        'domain': db_record.get('domain'),
        'industry': db_record.get('industry_id'),
        'annualRevenue': float(db_record.get('annual_revenue')) if db_record.get('annual_revenue') is not None else None,
        'employeeCount': db_record.get('employee_count'),
        'ownerId': db_record.get('owner_id'),
        'ownerName': db_record.get('owner_name'),
        'healthStatus': db_record.get('health_status'),
        'healthScore': db_record.get('health_score'),
        'opportunityCount': db_record.get('opportunity_count'),
        'totalOpportunityValue': float(db_record.get('total_opportunity_value')) if db_record.get('total_opportunity_value') is not None else None,
        'lastActivityDate': db_record.get('last_activity_date').isoformat() if db_record.get('last_activity_date') else None,
        'createdDate': db_record.get('created_date').isoformat() if db_record.get('created_date') else None,
        'logoUrl': db_record.get('logo_url')
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
    # NOTE: healthStatus, healthScore, opportunityCount, and totalOpportunityValue
    # are computed fields — they are NOT accepted from API input to prevent
    # manual manipulation. They are recalculated from business metrics automatically.
    field_mapping = {
        'name': 'name',
        'domain': 'domain',
        'industry': 'industry_id',
        'annualRevenue': 'annual_revenue',
        'employeeCount': 'employee_count',
        'ownerId': 'owner_id',
        'ownerName': 'owner_name',
        'lastActivityDate': 'last_activity_date',
        'createdDate': 'created_date',
        'logoUrl': 'logo_url'
    }
    
    for api_field, db_field in field_mapping.items():
        if api_field in api_data:
            db_data[db_field] = api_data[api_field]
    
    return db_data


def _recalculate_health(connection, account_id: str) -> None:
    """
    Stub function for health score recalculation.
    
    In a production system, this would recalculate health_status and health_score
    based on business metrics like opportunity value, activity, and engagement.
    For now, this is a no-op placeholder.
    
    Args:
        connection: Database connection object
        account_id: Account ID to recalculate health for
    """
    # Placeholder - health recalculation logic would go here
    pass


def list_accounts(connection, user_id: str) -> List[Dict[str, Any]]:
    """
    Query all accounts owned by the authenticated user.
    
    Implements resource-level authorization by filtering accounts
    to only those owned by the requesting user (CWE-639 mitigation).
    
    Args:
        connection: Database connection object
        user_id: Authenticated user ID from JWT claims
    
    Returns:
        List of account dictionaries owned by user in API format
    
    Raises:
        Exception: If database query fails
    """
    try:
        logger.info(f"Listing accounts for user: {user_id}")
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                id, name, domain, industry_id, annual_revenue, employee_count,
                owner_id, owner_name, health_status, health_score,
                opportunity_count, total_opportunity_value,
                last_activity_date, created_date, logo_url
            FROM accounts
              AND owner_id = %s
            WHERE deleted_at IS NULL
            ORDER BY name ASC
        """
        cursor.execute(query, (user_id,))
        cursor.execute(query)
        records = cursor.fetchall()
        cursor.close()
        
        # Map to API format
        accounts = [_map_account_to_api_format(dict(record)) for record in records]
        logger.info(f"Retrieved {len(accounts)} accounts for user {user_id}")
        logger.info(f"Retrieved {len(accounts)} accounts")
        return accounts
        
    except psycopg2.Error as e:
        logger.error(f"Database error listing accounts: {str(e)}")
        raise Exception(f"Failed to list accounts: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error listing accounts: {str(e)}")
        raise

# Fields that are computed from business metrics and cannot be set directly by users
COMPUTED_FIELDS = {'health_status', 'health_score', 'opportunity_count', 'total_opportunity_value'}



def get_account(connection, account_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Query a single account by ID owned by the authenticated user.
    
    Implements resource-level authorization by validating that the
    requested account belongs to the authenticated user (CWE-639 mitigation).
    Returns None (resulting in 404) if account doesn't exist or user doesn't own it,
    preventing resource enumeration attacks.
    
    Args:
        connection: Database connection object
        account_id: Account ID to retrieve
        user_id: Authenticated user ID from JWT claims
    
    Returns:
        Account dictionary in API format, or None if not found or unauthorized
    
    Raises:
        Exception: If database query fails
    """
    try:
        logger.info(f"Getting account {account_id} for user {user_id}")
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                id, name, domain, industry_id, annual_revenue, employee_count,
                owner_id, owner_name, health_status, health_score,
                opportunity_count, total_opportunity_value,
                last_activity_date, created_date, logo_url
            FROM accounts
            WHERE id = %s 
              AND owner_id = %s 
              AND deleted_at IS NULL
        """
        
        cursor.execute(query, (account_id, user_id))
        record = cursor.fetchone()
        cursor.close()
        
        if not record:
            logger.info(f"Account {account_id} not found or unauthorized for user {user_id}")
            return None
        
        # Map to API format
        account = _map_account_to_api_format(dict(record))
        
        logger.info(f"Retrieved account {account_id} for user {user_id}")
        return account
        
    except psycopg2.Error as e:
        logger.error(f"Database error getting account {account_id}: {str(e)}")
        raise Exception(f"Failed to get account: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error getting account {account_id}: {str(e)}")
        raise


def create_account(connection, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    """
    Insert a new account record owned by the authenticated user.
    
    Implements resource-level authorization by automatically setting
    owner_id to the authenticated user, preventing privilege escalation
    where users could create accounts owned by others (CWE-639 mitigation).
    
    Args:
        connection: Database connection object
        data: Account data in API format (camelCase)
        user_id: Authenticated user ID from JWT claims
    
    Returns:
        Created account dictionary in API format
    
    Raises:
        Exception: If database insert fails or validation fails
    """
    try:
        logger.info(f"Creating new account for user {user_id}: {data.get('name')}")
        
        # Map API format to database format
        db_data = _map_api_to_db_format(data)
        
        # Force owner_id to authenticated user - prevent privilege escalation
        # Users cannot create accounts owned by other users
        db_data['owner_id'] = user_id
        
        # Strip computed fields — these are derived from business metrics, not user input
        for field in COMPUTED_FIELDS:
            db_data.pop(field, None)
        
        # Generate ID if not provided
        if 'id' not in data:
            import uuid
            db_data['id'] = str(uuid.uuid4())
        else:
            db_data['id'] = data['id']
        
        # Set created_date if not provided
        if 'created_date' not in db_data:
            db_data['created_date'] = datetime.utcnow()
        
        # Set last_activity_date if not provided
        if 'last_activity_date' not in db_data:
            db_data['last_activity_date'] = datetime.utcnow()
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        # Build INSERT query dynamically based on provided fields
        columns = list(db_data.keys())
        placeholders = ['%s'] * len(columns)
        values = [db_data[col] for col in columns]
        
        query = f"""
            INSERT INTO accounts ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
            RETURNING 
                id, name, domain, industry_id, annual_revenue, employee_count,
                owner_id, owner_name, health_status, health_score,
                opportunity_count, total_opportunity_value,
                last_activity_date, created_date, logo_url
        """
        
        cursor.execute(query, values)
        record = cursor.fetchone()
        connection.commit()
        cursor.close()
        
        # Calculate health score from business metrics
        _recalculate_health(connection, db_data['id'])
        
        account = get_account(connection, db_data['id'], user_id)
        account = get_account(connection, db_data['id'])
        logger.info(f"Created account {db_data['id']} for user {user_id}")
        logger.info(f"Created account with ID: {db_data['id']}")
        return account
        
    except psycopg2.IntegrityError as e:
        connection.rollback()
        logger.error(f"Integrity error creating account: {str(e)}")
        # Check for specific constraint violations
        if 'foreign key' in str(e).lower():
            if 'industry_id' in str(e).lower():
                raise Exception("Invalid industry ID: industry does not exist")
            elif 'owner_id' in str(e).lower():
                raise Exception("Invalid owner ID: team member does not exist")
        raise Exception(f"Failed to create account: constraint violation")
    except psycopg2.Error as e:
        connection.rollback()
        logger.error(f"Database error creating account: {str(e)}")
        raise Exception(f"Failed to create account: {str(e)}")
    except Exception as e:
        connection.rollback()
        logger.error(f"Unexpected error creating account: {str(e)}")
        raise


def update_account(connection, account_id: str, data: Dict[str, Any], user_id: str) -> Optional[Dict[str, Any]]:
    """
    Update an existing account owned by the authenticated user.
    
    Implements resource-level authorization by validating ownership
    before allowing updates. Returns None (resulting in 404) if account
    doesn't exist or user doesn't own it (CWE-639 mitigation).
    
    Args:
        connection: Database connection object
        account_id: Account ID to update
        data: Partial account data in API format (camelCase)
        user_id: Authenticated user ID from JWT claims
    
    Returns:
        Updated account dictionary in API format, or None if not found or unauthorized
    
    Raises:
        Exception: If database update fails or validation fails
    """
    try:
        logger.info(f"Updating account {account_id} for user {user_id}")
        
        # Map API format to database format
        db_data = _map_api_to_db_format(data)
        
        # Prevent owner_id manipulation - users cannot transfer ownership
        db_data.pop('owner_id', None)
        
        # Remove id if present (shouldn't be updated)
        db_data.pop('id', None)
        
        # Strip computed fields — these are derived from business metrics, not user input
        for field in COMPUTED_FIELDS:
            db_data.pop(field, None)
            return get_account(connection, account_id, user_id)
        if not db_data:
            logger.warning("No fields to update")
            # Return current account
            return get_account(connection, account_id)
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        values.append(account_id)
        values.append(user_id)  # For owner_id check
        # Build UPDATE query dynamically based on provided fields
        set_clauses = [f"{col} = %s" for col in db_data.keys()]
        values = list(db_data.values())
        values.append(account_id)  # For WHERE clause
            WHERE id = %s 
              AND owner_id = %s
              AND deleted_at IS NULL
        query = f"""
            UPDATE accounts
            SET {', '.join(set_clauses)}
            WHERE id = %s
            RETURNING 
                id, name, domain, industry_id, annual_revenue, employee_count,
                owner_id, owner_name, health_status, health_score,
                opportunity_count, total_opportunity_value,
                last_activity_date, created_date, logo_url
        """
        
        cursor.execute(query, values)
        record = cursor.fetchone()
        
        if not record:
            connection.rollback()
            cursor.close()
            logger.info(f"Account {account_id} not found or unauthorized for user {user_id}")
            return None
        
        connection.commit()
        cursor.close()
        
        # Recalculate health score from business metrics
        _recalculate_health(connection, account_id)
        
        # Re-fetch to include recomputed fields
        account = get_account(connection, account_id, user_id)
        
        logger.info(f"Updated account {account_id} for user {user_id}")
        return account
        
    except psycopg2.IntegrityError as e:
        connection.rollback()
        logger.error(f"Integrity error updating account {account_id}: {str(e)}")
        # Check for specific constraint violations
        if 'foreign key' in str(e).lower():
            if 'industry_id' in str(e).lower():
                raise Exception("Invalid industry ID: industry does not exist")
            elif 'owner_id' in str(e).lower():
                raise Exception("Invalid owner ID: team member does not exist")
        raise Exception(f"Failed to update account: constraint violation")
    except psycopg2.Error as e:
        connection.rollback()
        logger.error(f"Database error updating account {account_id}: {str(e)}")
        raise Exception(f"Failed to update account: {str(e)}")
    except Exception as e:
        connection.rollback()
        logger.error(f"Unexpected error updating account {account_id}: {str(e)}")
        raise


def delete_account(connection, account_id: str, user_id: str) -> bool:
    """
    Soft-delete an account owned by the authenticated user.
    
    The record is retained in the database for recovery purposes.
    Checks for active (non-deleted) opportunities before allowing deletion.
    
    Implements resource-level authorization by validating ownership
    before allowing deletion (CWE-639 mitigation).
    
    Args:
        connection: Database connection object
        account_id: Account ID to soft-delete
        user_id: Authenticated user ID from JWT claims

    Returns:
        True if account was soft-deleted, False if not found or unauthorized

    Raises:
        Exception: If account has active opportunities or database update fails
    """
    try:
        logger.info(f"Soft-deleting account {account_id} for user {user_id}")

        cursor = connection.cursor()

        # Check if account exists, is owned by user, and is not already deleted
        cursor.execute(
            "SELECT id FROM accounts WHERE id = %s AND owner_id = %s AND (deleted_at IS NULL)",
            (account_id, user_id)
        )
        if not cursor.fetchone():
            cursor.close()
            logger.info(f"Account {account_id} not found or unauthorized for user {user_id}")
            return False

        # Check for active (non-deleted) associated opportunities
        cursor.execute(
            "SELECT COUNT(*) as count FROM opportunities WHERE account_id = %s AND (deleted_at IS NULL)",
            (account_id,)
        )
        result = cursor.fetchone()
        opportunity_count = result[0] if result else 0

        if opportunity_count > 0:
            cursor.close()
            logger.warning(f"Cannot delete account {account_id}: has {opportunity_count} active opportunities")
            raise Exception(
                f"Cannot delete account: account has {opportunity_count} active opportunities. "
                f"Delete or archive the opportunities first."
            )

        # Soft-delete: set deleted_at timestamp instead of removing the row
        cursor.execute(
            "UPDATE accounts SET deleted_at = NOW() WHERE id = %s",
            (account_id,)
        )
        connection.commit()
        cursor.close()

        logger.info(f"Soft-deleted account {account_id} for user {user_id}")
        return True

    except psycopg2.IntegrityError as e:
        connection.rollback()
        logger.error(f"Integrity error soft-deleting account {account_id}: {str(e)}")
        raise Exception(f"Cannot delete account: has associated records")
    except psycopg2.Error as e:
        connection.rollback()
        logger.error(f"Database error soft-deleting account {account_id}: {str(e)}")
        raise Exception(f"Failed to delete account: {str(e)}")
    except Exception as e:
        connection.rollback()
        # Re-raise if it's already our custom exception
        if "Cannot delete account" in str(e):
            raise
        logger.error(f"Unexpected error soft-deleting account {account_id}: {str(e)}")
        raise
