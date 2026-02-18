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
    field_mapping = {
        'name': 'name',
        'domain': 'domain',
        'industry': 'industry_id',
        'annualRevenue': 'annual_revenue',
        'employeeCount': 'employee_count',
        'ownerId': 'owner_id',
        'ownerName': 'owner_name',
        'opportunityCount': 'opportunity_count',
        'totalOpportunityValue': 'total_opportunity_value',
        'lastActivityDate': 'last_activity_date',
        'createdDate': 'created_date',
        'logoUrl': 'logo_url'
    }
    
    for api_field, db_field in field_mapping.items():
        if api_field in api_data:
            db_data[db_field] = api_data[api_field]
    
    return db_data


def _derive_health_from_opportunities(connection, account_id: str) -> Dict[str, Any]:
    """
    Derive account health based on opportunity data analysis.
    
    This prevents manual manipulation by calculating health from actual
    business metrics: opportunity value, activity timing, and deal count.
    
    Scoring algorithm:
    - 40% weight: Total deal value (normalized to $1M scale)
    - 30% weight: Activity freshness (days-based decay)
    - 30% weight: Deal pipeline size
    
    Status thresholds:
    - Green: score >= 80
    - Yellow: score >= 50 and < 80
    - Red: score < 50
    
    Args:
        connection: Active database connection
        account_id: Target account ID
    
    Returns:
        Dictionary containing health_score (int) and health_status (str)
    """
    cursor = None
    try:
        cursor = connection.cursor()
        
        # Aggregate opportunity metrics for the account
        query = """
            SELECT 
                COUNT(*) as deal_count,
                COALESCE(SUM(amount), 0) as total_deal_value,
                MAX(recent_activity_date) as most_recent_activity
            FROM opportunities
            WHERE account_id = %s
        """
        cursor.execute(query, (account_id,))
        
        metrics = cursor.fetchone()
        cursor.close()
        cursor = None
        
        # Handle no opportunities case
        if not metrics or metrics[0] == 0:
            return {
                'health_score': 50,
                'health_status': 'Yellow'
            }
        
        deal_count = int(metrics[0])
        total_deal_value = float(metrics[1])
        most_recent_activity = metrics[2]
        
        # Score calculation part 1: Deal value (40% contribution)
        # Scale from 0 to 100 where $1M = 100 points
        value_score = min(100.0, (total_deal_value / 10000.0))
        
        # Score calculation part 2: Activity freshness (30% contribution)
        # Recent activity = high score, stale activity = low score
        if most_recent_activity:
            current_time = datetime.utcnow().replace(tzinfo=most_recent_activity.tzinfo)
            days_since_activity = (current_time - most_recent_activity).days
            # Linear decay: 0 days = 100, 60 days = 0
            freshness_score = max(0.0, 100.0 - (days_since_activity * (100.0 / 60.0)))
        else:
            freshness_score = 0.0
        
        # Score calculation part 3: Deal count (30% contribution)
        # More deals = better health, capped at 6 deals = 100 points
        count_score = min(100.0, (deal_count / 6.0) * 100.0)
        
        # Weighted combination
        overall_score = int((value_score * 0.4) + (freshness_score * 0.3) + (count_score * 0.3))
        overall_status = 'Green' if overall_score >= 80 else ('Yellow' if overall_score >= 50 else 'Red')
        
        return {'health_score': overall_score, 'health_status': overall_status}
        
    except Exception as error:
        logger.error(f"Error deriving health for account {account_id}: {str(error)}")
        if cursor:
            cursor.close()
        # Fallback to neutral values on error
        return {'health_score': 50, 'health_status': 'Yellow'}


def list_accounts(connection) -> List[Dict[str, Any]]:
    """
    Query all accounts from the database.
    
    Args:
        connection: Database connection object
    
    Returns:
        List of account dictionaries in API format
    
    Raises:
        Exception: If database query fails
    """
    try:
        logger.info("Listing all accounts")
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                id, name, domain, industry_id, annual_revenue, employee_count,
                owner_id, owner_name, health_status, health_score,
                opportunity_count, total_opportunity_value,
                last_activity_date, created_date, logo_url
            FROM accounts
            ORDER BY name ASC
        """
        
        cursor.execute(query)
        records = cursor.fetchall()
        cursor.close()
        
        # Map to API format
        accounts = [_map_account_to_api_format(dict(record)) for record in records]
        
        logger.info(f"Retrieved {len(accounts)} accounts")
        return accounts
        
    except psycopg2.Error as e:
        logger.error(f"Database error listing accounts: {str(e)}")
        raise Exception(f"Failed to list accounts: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error listing accounts: {str(e)}")
        raise


def get_account(connection, account_id: str) -> Optional[Dict[str, Any]]:
    """
    Query a single account by ID from the database.
    
    Args:
        connection: Database connection object
        account_id: Account ID to retrieve
    
    Returns:
        Account dictionary in API format, or None if not found
    
    Raises:
        Exception: If database query fails
    """
    try:
        logger.info(f"Getting account with ID: {account_id}")
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                id, name, domain, industry_id, annual_revenue, employee_count,
                owner_id, owner_name, health_status, health_score,
                opportunity_count, total_opportunity_value,
                last_activity_date, created_date, logo_url
            FROM accounts
            WHERE id = %s
        """
        
        cursor.execute(query, (account_id,))
        record = cursor.fetchone()
        cursor.close()
        
        if not record:
            logger.info(f"Account not found: {account_id}")
            return None
        
        # Map to API format
        account = _map_account_to_api_format(dict(record))
        
        logger.info(f"Retrieved account: {account_id}")
        return account
        
    except psycopg2.Error as e:
        logger.error(f"Database error getting account {account_id}: {str(e)}")
        raise Exception(f"Failed to get account: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error getting account {account_id}: {str(e)}")
        raise


def create_account(connection, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Insert a new account record into the database.
    
    Args:
        connection: Database connection object
        data: Account data in API format (camelCase)
    
    Returns:
        Created account dictionary in API format
    
    Raises:
        Exception: If database insert fails or validation fails
    """
    try:
        logger.info(f"Creating new account: {data.get('name')}")
        
        # Map API format to database format
        db_data = _map_api_to_db_format(data)
        
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
        # Initialize health for new account (no opportunities yet)
        initial_health = {'health_score': 50, 'health_status': 'Yellow'}
        db_data.update(initial_health)
        
        
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
        
        # Map to API format
        account = _map_account_to_api_format(dict(record))
        
        logger.info(f"Created account with ID: {account['id']}")
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


def update_account(connection, account_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update an existing account record in the database.
    
    Args:
        connection: Database connection object
        account_id: Account ID to update
        data: Partial account data in API format (camelCase)
    
    Returns:
        Updated account dictionary in API format, or None if not found
    
    Raises:
        Exception: If database update fails or validation fails
    """
    try:
        logger.info(f"Updating account: {account_id}")
        
        # Map API format to database format
        db_data = _map_api_to_db_format(data)
        
        # Remove id if present (shouldn't be updated)
        db_data.pop('id', None)
        
        # Recalculate health based on current opportunity metrics
        derived_health = _derive_health_from_opportunities(connection, account_id)
        db_data.update(derived_health)
        
        if not db_data:
            logger.warning("No fields to update")
            # Return current account
            return get_account(connection, account_id)
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        # Build UPDATE query dynamically based on provided fields
        set_clauses = [f"{col} = %s" for col in db_data.keys()]
        values = list(db_data.values())
        values.append(account_id)  # For WHERE clause
        
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
            logger.info(f"Account not found for update: {account_id}")
            return None
        
        connection.commit()
        cursor.close()
        
        # Map to API format
        account = _map_account_to_api_format(dict(record))
        
        logger.info(f"Updated account: {account_id}")
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


def delete_account(connection, account_id: str) -> bool:
    """
    Delete an account record from the database.
    Checks for foreign key constraints (opportunities) before deletion.
    
    Args:
        connection: Database connection object
        account_id: Account ID to delete
    
    Returns:
        True if account was deleted, False if not found
    
    Raises:
        Exception: If account has associated opportunities or database delete fails
    """
    try:
        logger.info(f"Deleting account: {account_id}")
        
        cursor = connection.cursor()
        
        # Check if account exists
        cursor.execute("SELECT id FROM accounts WHERE id = %s", (account_id,))
        if not cursor.fetchone():
            cursor.close()
            logger.info(f"Account not found for deletion: {account_id}")
            return False
        
        # Check for associated opportunities (foreign key constraint)
        cursor.execute(
            "SELECT COUNT(*) as count FROM opportunities WHERE account_id = %s",
            (account_id,)
        )
        result = cursor.fetchone()
        opportunity_count = result[0] if result else 0
        
        if opportunity_count > 0:
            cursor.close()
            logger.warning(f"Cannot delete account {account_id}: has {opportunity_count} associated opportunities")
            raise Exception(
                f"Cannot delete account: account has {opportunity_count} associated opportunities. "
                f"Delete the opportunities first."
            )
        
        # Delete the account
        cursor.execute("DELETE FROM accounts WHERE id = %s", (account_id,))
        connection.commit()
        cursor.close()
        
        logger.info(f"Deleted account: {account_id}")
        return True
        
    except psycopg2.IntegrityError as e:
        connection.rollback()
        logger.error(f"Integrity error deleting account {account_id}: {str(e)}")
        raise Exception(f"Cannot delete account: has associated records")
    except psycopg2.Error as e:
        connection.rollback()
        logger.error(f"Database error deleting account {account_id}: {str(e)}")
        raise Exception(f"Failed to delete account: {str(e)}")
    except Exception as e:
        connection.rollback()
        # Re-raise if it's already our custom exception
        if "Cannot delete account" in str(e):
            raise
        logger.error(f"Unexpected error deleting account {account_id}: {str(e)}")
        raise
