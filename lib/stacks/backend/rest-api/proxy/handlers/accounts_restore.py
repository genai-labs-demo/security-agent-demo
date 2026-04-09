"""
Account restoration functions for soft-delete recovery.
Provides functions to restore and list deleted accounts.
"""

import logging
from typing import Dict, Any, List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def list_deleted_accounts(connection) -> List[Dict[str, Any]]:
    """
    Query soft-deleted accounts from the database.
    
    Args:
        connection: Database connection object
    
    Returns:
        List of deleted account dictionaries in API format
    
    Raises:
        Exception: If database query fails
    """
    try:
        # Import the mapping function from accounts_handler
        from . import accounts_handler
        
        logger.info("Listing deleted accounts")
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                id, name, domain, industry_id, annual_revenue, employee_count,
                owner_id, owner_name, health_status, health_score,
                opportunity_count, total_opportunity_value,
                last_activity_date, created_date, logo_url, deleted_at
            FROM accounts
            WHERE deleted_at IS NOT NULL
            ORDER BY deleted_at DESC
        """
        
        cursor.execute(query)
        records = cursor.fetchall()
        cursor.close()
        
        # Map to API format
        accounts = [accounts_handler._map_account_to_api_format(dict(record)) for record in records]
        
        logger.info(f"Retrieved {len(accounts)} deleted accounts")
        return accounts
        
    except psycopg2.Error as e:
        logger.error(f"Database error listing deleted accounts: {str(e)}")
        raise Exception(f"Failed to list deleted accounts: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error listing deleted accounts: {str(e)}")
        raise


def restore_account(connection, account_id: str) -> Optional[Dict[str, Any]]:
    """
    Restore a soft-deleted account by clearing the deleted_at timestamp.
    
    Args:
        connection: Database connection object
        account_id: Account ID to restore
    
    Returns:
        Restored account dictionary in API format, or None if not found
    
    Raises:
        Exception: If database update fails
    """
    try:
        # Import the get function from accounts_handler
        from . import accounts_handler
        
        logger.info(f"Restoring account: {account_id}")
        
        cursor = connection.cursor()
        
        # Check if account exists and is deleted
        cursor.execute(
            "SELECT id FROM accounts WHERE id = %s AND deleted_at IS NOT NULL",
            (account_id,)
        )
        if not cursor.fetchone():
            cursor.close()
            logger.info(f"Account not found or not deleted: {account_id}")
            return None
        
        # Restore: clear deleted_at timestamp
        cursor.execute(
            "UPDATE accounts SET deleted_at = NULL WHERE id = %s",
            (account_id,)
        )
        connection.commit()
        cursor.close()
        
        # Fetch and return the restored account
        account = accounts_handler.get_account(connection, account_id)
        
        logger.info(f"Restored account: {account_id}")
        return account
        
    except psycopg2.Error as e:
        connection.rollback()
        logger.error(f"Database error restoring account {account_id}: {str(e)}")
        raise Exception(f"Failed to restore account: {str(e)}")
    except Exception as e:
        connection.rollback()
        logger.error(f"Unexpected error restoring account {account_id}: {str(e)}")
        raise
