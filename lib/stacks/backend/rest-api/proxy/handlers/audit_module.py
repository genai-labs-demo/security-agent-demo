"""
Audit trail tracking for CRM system.
Records all CREATE/UPDATE/DELETE operations with user attribution.
"""

import logging
import json
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


def write_audit_log(conn_obj, target_table: str, target_id: str, 
                   action_name: str, actor_identity: Optional[str],
                   state_before: Optional[Dict] = None,
                   state_after: Optional[Dict] = None) -> bool:
    """
    Record audit information for a CRM operation.
    
    Args:
        conn_obj: Database connection
        target_table: Table name being modified
        target_id: Record ID being modified
        action_name: Operation type ('CREATE', 'UPDATE', 'DELETE')
        actor_identity: User performing the operation
        state_before: Previous record state (UPDATE/DELETE)
        state_after: New record state (CREATE/UPDATE)
    
    Returns:
        Boolean indicating success
    """
    if conn_obj is None:
        logger.warning("Cannot write audit log - connection is None")
        return False
    
    try:
        db_cursor = conn_obj.cursor()
        
        # Calculate changed fields for UPDATE operations
        modifications: List[str] = []
        if action_name == 'UPDATE' and state_before and state_after:
            for field_key in state_after:
                if field_key in state_before:
                    prior_value = state_before[field_key]
                    current_value = state_after[field_key]
                    if prior_value != current_value:
                        modifications.append(field_key)
        
        # Serialize to JSON for storage
        modifications_json = json.dumps(modifications) if len(modifications) > 0 else None
        state_before_json = None
        state_after_json = None
        
        if state_before is not None:
            state_before_json = json.dumps(state_before, default=str)
        if state_after is not None:
            state_after_json = json.dumps(state_after, default=str)
        
        # Insert into audit_log table
        insert_statement = """
            INSERT INTO audit_log 
            (table_name, record_id, operation, user_id, changed_fields, old_values, new_values, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        """
        
        db_cursor.execute(
            insert_statement,
            (target_table, target_id, action_name, actor_identity, 
             modifications_json, state_before_json, state_after_json)
        )
        
        conn_obj.commit()
        db_cursor.close()
        
        logger.info(f"Audit entry recorded: {action_name} on {target_table}.{target_id} by {actor_identity}")
        return True
        
    except Exception as audit_err:
        logger.error(f"Failed to write audit log: {audit_err}", exc_info=True)
        return False


