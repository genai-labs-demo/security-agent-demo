"""
Opportunity restoration functions for soft-delete recovery.
Provides functions to restore and list deleted opportunities.
"""

import logging
from typing import Dict, Any, List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def list_deleted_opportunities(connection, account_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Query soft-deleted opportunities from the database.
    
    Args:
        connection: Database connection object
        account_id: Optional account ID to filter opportunities
    
    Returns:
        List of deleted opportunity dictionaries in API format
    
    Raises:
        Exception: If database query fails
    """
    try:
        # Import the mapping function from opportunities_handler
        from . import opportunities_handler
        
        logger.info(f"Listing deleted opportunities{f' for account {account_id}' if account_id else ''}")
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                id, name, account_id, account_name, amount, close_date,
                stage, next_step, recent_activity, recent_activity_date,
                forecast_category, owner_id, owner_name, probability,
                created_date, last_modified_date, deleted_at
            FROM opportunities
            WHERE deleted_at IS NOT NULL
        """
        
        params = []
        if account_id:
            query += " AND account_id = %s"
            params.append(account_id)
        
        query += " ORDER BY deleted_at DESC LIMIT 1000"
        
        cursor.execute(query, params)
        records = cursor.fetchall()
        cursor.close()
        
        # Map to API format
        opportunities = [opportunities_handler._map_opportunity_to_api_format(dict(record)) for record in records]
        
        logger.info(f"Retrieved {len(opportunities)} deleted opportunities")
        return opportunities
        
    except psycopg2.Error as e:
        logger.error(f"Database error listing deleted opportunities: {str(e)}")
        raise Exception(f"Failed to list deleted opportunities: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error listing deleted opportunities: {str(e)}")
        raise


def restore_opportunity(connection, opportunity_id: str) -> Optional[Dict[str, Any]]:
    """
    Restore a soft-deleted opportunity by clearing the deleted_at timestamp.
    
    Args:
        connection: Database connection object
        opportunity_id: Opportunity ID to restore
    
    Returns:
        Restored opportunity dictionary in API format, or None if not found
    
    Raises:
        Exception: If database update fails
    """
    try:
        # Import the get function from opportunities_handler
        from . import opportunities_handler
        
        logger.info(f"Restoring opportunity: {opportunity_id}")
        
        cursor = connection.cursor()
        
        # Check if opportunity exists and is deleted, and get account_id
        cursor.execute(
            "SELECT id, account_id FROM opportunities WHERE id = %s AND deleted_at IS NOT NULL",
            (opportunity_id,)
        )
        row = cursor.fetchone()
        if not row:
            cursor.close()
            logger.info(f"Opportunity not found or not deleted: {opportunity_id}")
            return None
        
        account_id = row[1]
        
        # Restore: clear deleted_at timestamp
        cursor.execute(
            "UPDATE opportunities SET deleted_at = NULL WHERE id = %s",
            (opportunity_id,)
        )
        connection.commit()
        cursor.close()
        
        # Recalculate parent account aggregates
        opportunities_handler._recalculate_account_aggregates(connection, account_id)
        
        # Fetch and return the restored opportunity
        opportunity = opportunities_handler.get_opportunity(connection, opportunity_id)
        
        logger.info(f"Restored opportunity: {opportunity_id}")
        return opportunity
        
    except psycopg2.Error as e:
        connection.rollback()
        logger.error(f"Database error restoring opportunity {opportunity_id}: {str(e)}")
        raise Exception(f"Failed to restore opportunity: {str(e)}")
    except Exception as e:
        connection.rollback()
        logger.error(f"Unexpected error restoring opportunity {opportunity_id}: {str(e)}")
        raise
