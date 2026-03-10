"""Audit trail for CRM mutations"""

import logging
from datetime import datetime
from psycopg2.extras import Json

logger = logging.getLogger()


def write_audit_trail(db_conn, entity_type, entity_id, operation_type, user_ctx=None, before_state=None, after_state=None, client_ip=None, client_agent=None):
    """
    Persist audit record to audit_log table.
    
    Parameters:
        db_conn: PostgreSQL connection
        entity_type: 'accounts', 'opportunities', or 'team_members'
        entity_id: Primary key of modified entity
        operation_type: 'CREATE', 'UPDATE', or 'DELETE'
        user_ctx: Dict with 'user_id'/'sub' and 'user_email'/'email' from Cognito
        before_state: Dict of values before change (for UPDATE/DELETE)
        after_state: Dict of values after change (for CREATE/UPDATE)
        client_ip: Request source IP
        client_agent: User-Agent string
    """
    
    uid = None
    uemail = None
    if user_ctx:
        uid = user_ctx.get('user_id', user_ctx.get('sub'))
        uemail = user_ctx.get('user_email', user_ctx.get('email'))
    
    summary = build_summary(operation_type, entity_type, entity_id, before_state, after_state)
    
    try:
        cur = db_conn.cursor()
        
        sql = """
        INSERT INTO audit_log (
            entity_type, entity_id, action, user_id, user_email,
            timestamp, old_values, new_values, changes_summary,
            ip_address, user_agent
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        cur.execute(sql, (
            entity_type,
            entity_id,
            operation_type,
            uid,
            uemail,
            datetime.utcnow(),
            Json(before_state) if before_state else None,
            Json(after_state) if after_state else None,
            summary,
            client_ip,
            client_agent
        ))
        
        db_conn.commit()
        cur.close()
        logger.info(f"Audit: {operation_type} {entity_type}/{entity_id} by user {uemail or uid or 'anonymous'}")
    except Exception as ex:
        logger.error(f"Audit write failed: {ex}")


def build_summary(op, etype, eid, old, new):
    """Generate human-readable change description"""
    if op == 'CREATE':
        return f"Created new {etype} record {eid}"
    elif op == 'DELETE':
        return f"Removed {etype} record {eid}"
    elif op == 'UPDATE' and old and new:
        diff_keys = [k for k in new if old.get(k) != new.get(k)]
        return f"Modified {etype} {eid} fields: {', '.join(diff_keys) if diff_keys else 'none'}"
    return f"{op} operation on {etype} {eid}"
