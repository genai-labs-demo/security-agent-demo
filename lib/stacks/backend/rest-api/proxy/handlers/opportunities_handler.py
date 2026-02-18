"""
Opportunities handler module for CRUD operations on opportunity entities.
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


def _map_opportunity_to_api_format(db_record: Dict[str, Any]) -> Dict[str, Any]:
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
        'accountId': db_record.get('account_id'),
        'accountName': db_record.get('account_name'),
        'amount': float(db_record.get('amount')) if db_record.get('amount') is not None else None,
        'closeDate': db_record.get('close_date').isoformat() if db_record.get('close_date') else None,
        'stage': db_record.get('stage'),
        'nextStep': db_record.get('next_step'),
        'recentActivity': db_record.get('recent_activity'),
        'recentActivityDate': db_record.get('recent_activity_date').isoformat() if db_record.get('recent_activity_date') else None,
        'forecastCategory': db_record.get('forecast_category'),
        'ownerId': db_record.get('owner_id'),
        'ownerName': db_record.get('owner_name'),
        'probability': db_record.get('probability'),
        'createdDate': db_record.get('created_date').isoformat() if db_record.get('created_date') else None,
        'lastModifiedDate': db_record.get('last_modified_date').isoformat() if db_record.get('last_modified_date') else None
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
        'accountId': 'account_id',
        'accountName': 'account_name',
        'amount': 'amount',
        'closeDate': 'close_date',
        'stage': 'stage',
        'nextStep': 'next_step',
        'recentActivity': 'recent_activity',
        'recentActivityDate': 'recent_activity_date',
        'forecastCategory': 'forecast_category',
        'ownerId': 'owner_id',
        'ownerName': 'owner_name',
        'probability': 'probability',
        'createdDate': 'created_date',
        'lastModifiedDate': 'last_modified_date'
    }
    
    for api_field, db_field in field_mapping.items():
        if api_field in api_data:
            db_data[db_field] = api_data[api_field]
    
    return db_data



def _recalculate_account_metrics(connection, account_id: str) -> None:
    """
    Recalculate and update aggregate metrics for an account.
    
    This function ensures data integrity by recalculating:
    - opportunity_count: Total number of opportunities for this account
    - total_opportunity_value: Sum of all opportunity amounts for this account
    
    Args:
        connection: Database connection object
        account_id: Account ID to recalculate metrics for
    
    Raises:
        Exception: If database update fails
    """
    try:
        if not account_id:
            return
        
        cursor = connection.cursor()
        
        # Calculate aggregate metrics from opportunities table
        query = """
            UPDATE accounts
            SET 
                opportunity_count = COALESCE((
                    SELECT COUNT(*)
                    FROM opportunities
                    WHERE account_id = %s
                ), 0),
                total_opportunity_value = COALESCE((
                    SELECT SUM(amount)
                    FROM opportunities
                    WHERE account_id = %s
                ), 0)
            WHERE id = %s
        """
        
        cursor.execute(query, (account_id, account_id, account_id))
        cursor.close()
        
        logger.info(f"Recalculated metrics for account: {account_id}")
        
    except psycopg2.Error as e:
        logger.error(f"Database error recalculating account metrics for {account_id}: {str(e)}")
        raise Exception(f"Failed to recalculate account metrics: {str(e)}")


def _recalculate_team_member_metrics(connection, owner_id: str) -> None:
    """
    Recalculate and update aggregate metrics for a team member.
    
    This function ensures data integrity by recalculating:
    - opportunity_count: Total number of opportunities owned by this team member
    - pipeline_value: Sum of opportunities in pipeline stages (Pipeline, Best Case, Commit)
    - closed_won_value: Sum of opportunities in Closed Won stage
    - quota_attainment: Percentage of quota achieved (closed_won_value / quota * 100)
    
    Args:
        connection: Database connection object
        owner_id: Team member ID to recalculate metrics for
    
    Raises:
        Exception: If database update fails
    """
    try:
        if not owner_id:
            return
        
        cursor = connection.cursor()
        
        # Calculate aggregate metrics from opportunities table
        query = """
            UPDATE team_members
            SET 
                opportunity_count = COALESCE((
                    SELECT COUNT(*)
                    FROM opportunities
                    WHERE owner_id = %s
                ), 0),
                pipeline_value = COALESCE((
                    SELECT SUM(amount)
                    FROM opportunities
                    WHERE owner_id = %s AND stage IN ('Pipeline', 'Best Case', 'Commit')
                ), 0),
                closed_won_value = COALESCE((
                    SELECT SUM(amount)
                    FROM opportunities
                    WHERE owner_id = %s AND stage = 'Closed Won'
                ), 0),
                quota_attainment = CASE WHEN quota > 0 THEN ROUND((COALESCE((SELECT SUM(amount) FROM opportunities WHERE owner_id = %s AND stage = 'Closed Won'), 0) / quota * 100)::numeric, 2) ELSE 0 END
            WHERE id = %s
        """
        
        cursor.execute(query, (owner_id, owner_id, owner_id, owner_id, owner_id))
        cursor.close()
        
        logger.info(f"Recalculated metrics for team member: {owner_id}")
        
    except psycopg2.Error as e:
        logger.error(f"Database error recalculating team member metrics for {owner_id}: {str(e)}")
        raise Exception(f"Failed to recalculate team member metrics: {str(e)}")

def search_opportunities(connection, search_query: str, account_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Perform full text search on opportunities using multiple keywords.
    
    Args:
        connection: Database connection object
        search_query: Search string (e.g., "finance software platform")
        account_id: Optional account ID to filter opportunities
    
    Returns:
        List of opportunity dictionaries in API format, ordered by relevance
    
    Raises:
        Exception: If database query fails
    """
    try:
        if not search_query or not search_query.strip():
            return []
        
        keywords = search_query.strip().split()
        logger.info(f"Searching opportunities for keywords: {keywords}")
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        # Create WHERE conditions for each keyword (must find ALL keywords)
        keyword_conditions = []
        keyword_params = []
        
        for keyword in keywords:
            # Each keyword must appear in at least one of the searchable fields
            keyword_condition = """
                (o.name ILIKE %s OR 
                 COALESCE(o.next_step, '') ILIKE %s OR 
                 COALESCE(o.recent_activity, '') ILIKE %s OR
                 a.name ILIKE %s OR
                 COALESCE(tm.name, '') ILIKE %s OR
                 COALESCE(tm.role, '') ILIKE %s)
            """
            keyword_conditions.append(keyword_condition)
            # Add the same keyword 6 times for each field
            for _ in range(6):
                keyword_params.append(f'%{keyword}%')
        
        # Join all keyword conditions with AND (all keywords must match)
        where_clause = " AND ".join(keyword_conditions)
        
        # Build relevance scoring SQL for each keyword
        relevance_parts = []
        match_count_parts = []
        
        for _ in keywords:
            relevance_parts.append("""
                    (CASE WHEN o.name ILIKE %s THEN 3 ELSE 0 END +
                     CASE WHEN COALESCE(o.next_step, '') ILIKE %s THEN 2 ELSE 0 END +
                     CASE WHEN COALESCE(o.recent_activity, '') ILIKE %s THEN 2 ELSE 0 END +
                     CASE WHEN a.name ILIKE %s THEN 1 ELSE 0 END +
                     CASE WHEN COALESCE(tm.name, '') ILIKE %s THEN 1 ELSE 0 END)
                    """)
            
            match_count_parts.append("""
                    (CASE WHEN o.name ILIKE %s THEN 1 ELSE 0 END +
                     CASE WHEN COALESCE(o.next_step, '') ILIKE %s THEN 1 ELSE 0 END +
                     CASE WHEN COALESCE(o.recent_activity, '') ILIKE %s THEN 1 ELSE 0 END +
                     CASE WHEN a.name ILIKE %s THEN 1 ELSE 0 END +
                     CASE WHEN COALESCE(tm.name, '') ILIKE %s THEN 1 ELSE 0 END +
                     CASE WHEN COALESCE(tm.role, '') ILIKE %s THEN 1 ELSE 0 END)
                    """)
        
        relevance_sql = " + ".join(relevance_parts)
        match_count_sql = " + ".join(match_count_parts)
        
        # Build the search query
        query = f"""
            SELECT 
                o.id, o.name, o.account_id, o.account_name, o.amount, o.close_date,
                o.stage, o.next_step, o.recent_activity, o.recent_activity_date,
                o.forecast_category, o.owner_id, o.owner_name, o.probability,
                o.created_date, o.last_modified_date,
                -- Calculate relevance score based on keyword matches
                (
                    {relevance_sql}
                ) as relevance_score,
                -- Count total keyword matches across all fields
                (
                    {match_count_sql}
                ) as match_count
            FROM opportunities o
            JOIN accounts a ON o.account_id = a.id
            LEFT JOIN team_members tm ON o.owner_id = tm.id
            WHERE 
                {where_clause}
        """
        
        # Add account filter if specified
        if account_id:
            query += " AND o.account_id = %s"
            keyword_params.append(account_id)
        
        query += """
            ORDER BY 
                relevance_score DESC,
                match_count DESC,
                o.amount DESC
            LIMIT 100
        """
        
        # Prepare all parameters
        all_params = keyword_params.copy()  # WHERE clause parameters
        
        # Add parameters for relevance scoring (5 per keyword)
        for keyword in keywords:
            for _ in range(5):
                all_params.append(f'%{keyword}%')
        
        # Add parameters for match counting (6 per keyword)
        for keyword in keywords:
            for _ in range(6):
                all_params.append(f'%{keyword}%')
        
        cursor.execute(query, all_params)
        records = cursor.fetchall()
        cursor.close()
        
        # Map to API format (excluding relevance_score and match_count)
        opportunities = []
        for record in records:
            opportunity = _map_opportunity_to_api_format(dict(record))
            # Add search metadata
            opportunity['relevanceScore'] = record.get('relevance_score', 0)
            opportunity['matchCount'] = record.get('match_count', 0)
            opportunities.append(opportunity)
        
        logger.info(f"Found {len(opportunities)} opportunities matching search query")
        return opportunities
        
    except psycopg2.Error as e:
        logger.error(f"Database error searching opportunities: {str(e)}")
        raise Exception(f"Failed to search opportunities: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error searching opportunities: {str(e)}")
        raise


def list_opportunities(connection, account_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Query opportunities from the database with optional account filter.
    
    Args:
        connection: Database connection object
        account_id: Optional account ID to filter opportunities
    
    Returns:
        List of opportunity dictionaries in API format
    
    Raises:
        Exception: If database query fails
    """
    try:
        logger.info(f"Listing opportunities{f' for account {account_id}' if account_id else ''}")
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                id, name, account_id, account_name, amount, close_date,
                stage, next_step, recent_activity, recent_activity_date,
                forecast_category, owner_id, owner_name, probability,
                created_date, last_modified_date
            FROM opportunities
        """
        
        params = []
        if account_id:
            query += " WHERE account_id = %s"
            params.append(account_id)
        
        query += " ORDER BY close_date DESC LIMIT 1000"
        
        cursor.execute(query, params)
        records = cursor.fetchall()
        cursor.close()
        
        # Map to API format
        opportunities = [_map_opportunity_to_api_format(dict(record)) for record in records]
        
        logger.info(f"Retrieved {len(opportunities)} opportunities")
        return opportunities
        
    except psycopg2.Error as e:
        logger.error(f"Database error listing opportunities: {str(e)}")
        raise Exception(f"Failed to list opportunities: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error listing opportunities: {str(e)}")
        raise


def get_opportunity(connection, opportunity_id: str) -> Optional[Dict[str, Any]]:
    """
    Query a single opportunity by ID from the database.
    
    Args:
        connection: Database connection object
        opportunity_id: Opportunity ID to retrieve
    
    Returns:
        Opportunity dictionary in API format, or None if not found
    
    Raises:
        Exception: If database query fails
    """
    try:
        logger.info(f"Getting opportunity with ID: {opportunity_id}")
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                id, name, account_id, account_name, amount, close_date,
                stage, next_step, recent_activity, recent_activity_date,
                forecast_category, owner_id, owner_name, probability,
                created_date, last_modified_date
            FROM opportunities
            WHERE id = %s
        """
        
        cursor.execute(query, (opportunity_id,))
        record = cursor.fetchone()
        cursor.close()
        
        if not record:
            logger.info(f"Opportunity not found: {opportunity_id}")
            return None
        
        # Map to API format
        opportunity = _map_opportunity_to_api_format(dict(record))
        
        logger.info(f"Retrieved opportunity: {opportunity_id}")
        return opportunity
        
    except psycopg2.Error as e:
        logger.error(f"Database error getting opportunity {opportunity_id}: {str(e)}")
        raise Exception(f"Failed to get opportunity: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error getting opportunity {opportunity_id}: {str(e)}")
        raise


def create_opportunity(connection, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Insert a new opportunity record into the database.
    Validates that account_id and owner_id reference existing records.
    
    Args:
        connection: Database connection object
        data: Opportunity data in API format (camelCase)
    
    Returns:
        Created opportunity dictionary in API format
    
    Raises:
        Exception: If database insert fails or validation fails
    """
    try:
        logger.info(f"Creating new opportunity: {data.get('name')}")
        
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
        
        # Set last_modified_date if not provided
        if 'last_modified_date' not in db_data:
            db_data['last_modified_date'] = datetime.utcnow()
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        # Validate account_id exists
        if 'account_id' in db_data and db_data['account_id']:
            cursor.execute("SELECT id FROM accounts WHERE id = %s", (db_data['account_id'],))
            if not cursor.fetchone():
                cursor.close()
                raise Exception(f"Invalid account ID: account does not exist")
        
        # Validate owner_id exists
        if 'owner_id' in db_data and db_data['owner_id']:
            cursor.execute("SELECT id FROM team_members WHERE id = %s", (db_data['owner_id'],))
            if not cursor.fetchone():
                cursor.close()
                raise Exception(f"Invalid owner ID: team member does not exist")
        
        # Build INSERT query dynamically based on provided fields
        columns = list(db_data.keys())
        placeholders = ['%s'] * len(columns)
        values = [db_data[col] for col in columns]
        
        query = f"""
            INSERT INTO opportunities ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
            RETURNING 
                id, name, account_id, account_name, amount, close_date,
                stage, next_step, recent_activity, recent_activity_date,
                forecast_category, owner_id, owner_name, probability,
                created_date, last_modified_date
        """
        
        cursor.execute(query, values)
        record = cursor.fetchone()
        connection.commit()
        
        # Map to API format
        opportunity = _map_opportunity_to_api_format(dict(record))
        
        logger.info(f"Created opportunity with ID: {opportunity['id']}")
        # Recalculate aggregate metrics for account and team member
        if db_data.get('account_id'):
            _recalculate_account_metrics(connection, db_data['account_id'])
        if db_data.get('owner_id'):
            _recalculate_team_member_metrics(connection, db_data['owner_id'])
        
        connection.commit()
        
        return opportunity
        
    except psycopg2.IntegrityError as e:
        connection.rollback()
        logger.error(f"Integrity error creating opportunity: {str(e)}")
        # Check for specific constraint violations
        if 'foreign key' in str(e).lower():
            if 'account_id' in str(e).lower():
                raise Exception("Invalid account ID: account does not exist")
            elif 'owner_id' in str(e).lower():
                raise Exception("Invalid owner ID: team member does not exist")
        raise Exception(f"Failed to create opportunity: constraint violation")
    except psycopg2.Error as e:
        connection.rollback()
        logger.error(f"Database error creating opportunity: {str(e)}")
        raise Exception(f"Failed to create opportunity: {str(e)}")
    except Exception as e:
        connection.rollback()
        # Re-raise if it's already our custom exception
        if "Invalid account ID" in str(e) or "Invalid owner ID" in str(e):
            raise
        logger.error(f"Unexpected error creating opportunity: {str(e)}")
        raise


def update_opportunity(connection, opportunity_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update an existing opportunity record in the database.
    
    Args:
        connection: Database connection object
        opportunity_id: Opportunity ID to update
        data: Partial opportunity data in API format (camelCase)
    
    Returns:
        Updated opportunity dictionary in API format, or None if not found
    
    Raises:
        Exception: If database update fails or validation fails
    """
    try:
        logger.info(f"Updating opportunity: {opportunity_id}")
        
        
        # Get current opportunity to track account/owner changes
        cursor_temp = connection.cursor(cursor_factory=RealDictCursor)
        cursor_temp.execute("SELECT account_id, owner_id FROM opportunities WHERE id = %s", (opportunity_id,))
        old_record = cursor_temp.fetchone()
        cursor_temp.close()
        old_account_id = old_record['account_id'] if old_record else None
        old_owner_id = old_record['owner_id'] if old_record else None
        # Map API format to database format
        db_data = _map_api_to_db_format(data)
        
        # Remove id if present (shouldn't be updated)
        db_data.pop('id', None)
        
        # Update last_modified_date
        db_data['last_modified_date'] = datetime.utcnow()
        
        if not db_data or (len(db_data) == 1 and 'last_modified_date' in db_data):
            logger.warning("No fields to update")
            # Return current opportunity
            return get_opportunity(connection, opportunity_id)
        
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        # Validate account_id exists if being updated
        if 'account_id' in db_data and db_data['account_id']:
            cursor.execute("SELECT id FROM accounts WHERE id = %s", (db_data['account_id'],))
            if not cursor.fetchone():
                cursor.close()
                raise Exception(f"Invalid account ID: account does not exist")
        
        # Validate owner_id exists if being updated
        if 'owner_id' in db_data and db_data['owner_id']:
            cursor.execute("SELECT id FROM team_members WHERE id = %s", (db_data['owner_id'],))
            if not cursor.fetchone():
                cursor.close()
                raise Exception(f"Invalid owner ID: team member does not exist")
        
        # Build UPDATE query dynamically based on provided fields
        set_clauses = [f"{col} = %s" for col in db_data.keys()]
        values = list(db_data.values())
        values.append(opportunity_id)  # For WHERE clause
        
        query = f"""
            UPDATE opportunities
            SET {', '.join(set_clauses)}
            WHERE id = %s
            RETURNING 
                id, name, account_id, account_name, amount, close_date,
                stage, next_step, recent_activity, recent_activity_date,
                forecast_category, owner_id, owner_name, probability,
                created_date, last_modified_date
        """
        
        cursor.execute(query, values)
        record = cursor.fetchone()
        
        if not record:
            connection.rollback()
            cursor.close()
            logger.info(f"Opportunity not found for update: {opportunity_id}")
            return None
        
        connection.commit()
        
        # Map to API format
        opportunity = _map_opportunity_to_api_format(dict(record))
        
        logger.info(f"Updated opportunity: {opportunity_id}")
        # Recalculate aggregate metrics for affected accounts and team members
        new_account_id = db_data.get('account_id', old_account_id)
        new_owner_id = db_data.get('owner_id', old_owner_id)
        
        # Recalculate old account if it changed
        if old_account_id and new_account_id != old_account_id:
            _recalculate_account_metrics(connection, old_account_id)
        # Recalculate new/current account
        if new_account_id:
            _recalculate_account_metrics(connection, new_account_id)
        
        # Recalculate old owner if it changed
        if old_owner_id and new_owner_id != old_owner_id:
            _recalculate_team_member_metrics(connection, old_owner_id)
        # Recalculate new/current owner
        if new_owner_id:
            _recalculate_team_member_metrics(connection, new_owner_id)
        
        connection.commit()
        
        return opportunity
        
    except psycopg2.IntegrityError as e:
        connection.rollback()
        logger.error(f"Integrity error updating opportunity {opportunity_id}: {str(e)}")
        # Check for specific constraint violations
        if 'foreign key' in str(e).lower():
            if 'account_id' in str(e).lower():
                raise Exception("Invalid account ID: account does not exist")
            elif 'owner_id' in str(e).lower():
                raise Exception("Invalid owner ID: team member does not exist")
        raise Exception(f"Failed to update opportunity: constraint violation")
    except psycopg2.Error as e:
        connection.rollback()
        logger.error(f"Database error updating opportunity {opportunity_id}: {str(e)}")
        raise Exception(f"Failed to update opportunity: {str(e)}")
    except Exception as e:
        connection.rollback()
        # Re-raise if it's already our custom exception
        if "Invalid account ID" in str(e) or "Invalid owner ID" in str(e):
            raise
        logger.error(f"Unexpected error updating opportunity {opportunity_id}: {str(e)}")
        raise


def delete_opportunity(connection, opportunity_id: str) -> bool:
    """
    Delete an opportunity record from the database.
    
    Args:
        connection: Database connection object
        opportunity_id: Opportunity ID to delete
    
    Returns:
        True if opportunity was deleted, False if not found
    
    Raises:
        Exception: If database delete fails
    """
    try:
        logger.info(f"Deleting opportunity: {opportunity_id}")
        
        cursor = connection.cursor()
        
        # Check if opportunity exists
        # Get opportunity details before deletion to recalculate metrics
        if not cursor.fetchone():
        opp_record = cursor.fetchone()
        if not opp_record:
            logger.info(f"Opportunity not found for deletion: {opportunity_id}")
            return False
        
        # Delete the opportunity
        account_id, owner_id = opp_record
        
        cursor.execute("DELETE FROM opportunities WHERE id = %s", (opportunity_id,))
        connection.commit()
        
        logger.info(f"Deleted opportunity: {opportunity_id}")
        # Recalculate aggregate metrics for account and team member
        if account_id:
            _recalculate_account_metrics(connection, account_id)
        if owner_id:
            _recalculate_team_member_metrics(connection, owner_id)
        
        connection.commit()
        
        return True
        
    except psycopg2.Error as e:
        connection.rollback()
        logger.error(f"Database error deleting opportunity {opportunity_id}: {str(e)}")
        raise Exception(f"Failed to delete opportunity: {str(e)}")
    except Exception as e:
        connection.rollback()
        logger.error(f"Unexpected error deleting opportunity {opportunity_id}: {str(e)}")
        raise
