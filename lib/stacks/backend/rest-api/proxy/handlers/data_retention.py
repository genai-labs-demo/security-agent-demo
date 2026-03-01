"""
Data retention and purge module for GDPR compliance and data minimization.

This module provides centralized functions to permanently delete (hard-delete)
soft-deleted records that have exceeded their retention period. This supports:
- GDPR Article 17 "Right to Erasure"
- Data minimization security principle
- Reduced attack surface by removing unnecessary data

Configuration:
- DATA_RETENTION_DAYS: Number of days to retain soft-deleted records (default: 90)
- ENABLE_AUTOMATIC_PURGE: Enable/disable automated purge (default: false)
"""

import logging
import os
from typing import Dict, Any
from datetime import datetime, timedelta
import psycopg2

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Default retention period: 90 days for soft-deleted records
DEFAULT_RETENTION_DAYS = 90


def get_retention_days() -> int:
    """
    Get the data retention period from environment variable.
    
    Returns:
        Number of days to retain soft-deleted records before hard deletion
    """
    try:
        retention_days = int(os.environ.get('DATA_RETENTION_DAYS', DEFAULT_RETENTION_DAYS))
        if retention_days < 1:
            logger.warning(f"Invalid DATA_RETENTION_DAYS value: {retention_days}, using default: {DEFAULT_RETENTION_DAYS}")
            return DEFAULT_RETENTION_DAYS
        return retention_days
    except (TypeError, ValueError):
        logger.warning(f"Invalid DATA_RETENTION_DAYS format, using default: {DEFAULT_RETENTION_DAYS}")
        return DEFAULT_RETENTION_DAYS


def is_purge_enabled() -> bool:
    """
    Check if automatic purge is enabled via environment variable.
    
    Returns:
        True if automatic purge is enabled, False otherwise
    """
    enabled = os.environ.get('ENABLE_AUTOMATIC_PURGE', 'false').lower()
    return enabled in ('true', '1', 'yes', 'enabled')


def purge_deleted_opportunities(connection) -> Dict[str, Any]:
    """
    Permanently delete (hard-delete) opportunities that have been soft-deleted
    and exceeded the retention period.
    
    This function supports GDPR "Right to Erasure" and data minimization by
    removing records that are no longer needed for business or legal purposes.
    
    Args:
        connection: Database connection object
    
    Returns:
        Dictionary with purge statistics:
        - purged_count: Number of records permanently deleted
        - retention_days: Retention period used
        - cutoff_date: Records deleted before this date were purged
    
    Raises:
        Exception: If database operation fails
    """
    try:
        retention_days = get_retention_days()
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        
        logger.info(f"Starting opportunity purge: retention_days={retention_days}, cutoff_date={cutoff_date.isoformat()}")
        
        cursor = connection.cursor()
        
        # Permanently delete opportunities that were soft-deleted before cutoff date
        cursor.execute("""
            DELETE FROM opportunities
            WHERE deleted_at IS NOT NULL 
              AND deleted_at < %s
        """, (cutoff_date,))
        
        purged_count = cursor.rowcount
        connection.commit()
        cursor.close()
        
        logger.info(f"Purged {purged_count} opportunities soft-deleted before {cutoff_date.isoformat()}")
        
        return {
            'purged_count': purged_count,
            'retention_days': retention_days,
            'cutoff_date': cutoff_date.isoformat()
        }
        
    except psycopg2.Error as e:
        connection.rollback()
        logger.error(f"Database error purging opportunities: {str(e)}")
        raise Exception(f"Failed to purge opportunities: {str(e)}")
    except Exception as e:
        connection.rollback()
        logger.error(f"Unexpected error purging opportunities: {str(e)}")
        raise


def purge_deleted_accounts(connection) -> Dict[str, Any]:
    """
    Permanently delete (hard-delete) accounts that have been soft-deleted
    and exceeded the retention period.
    
    Args:
        connection: Database connection object
    
    Returns:
        Dictionary with purge statistics
    
    Raises:
        Exception: If database operation fails
    """
    try:
        retention_days = get_retention_days()
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        
        logger.info(f"Starting account purge: retention_days={retention_days}, cutoff_date={cutoff_date.isoformat()}")
        
        cursor = connection.cursor()
        cursor.execute("""
            DELETE FROM accounts
            WHERE deleted_at IS NOT NULL 
              AND deleted_at < %s
        """, (cutoff_date,))
        
        purged_count = cursor.rowcount
        connection.commit()
        cursor.close()
        
        logger.info(f"Purged {purged_count} accounts soft-deleted before {cutoff_date.isoformat()}")
        
        return {
            'purged_count': purged_count,
            'retention_days': retention_days,
            'cutoff_date': cutoff_date.isoformat()
        }
        
    except psycopg2.Error as e:
        connection.rollback()
        logger.error(f"Database error purging accounts: {str(e)}")
        raise Exception(f"Failed to purge accounts: {str(e)}")
    except Exception as e:
        connection.rollback()
        logger.error(f"Unexpected error purging accounts: {str(e)}")
        raise


def purge_all_deleted_records(connection) -> Dict[str, Any]:
    """
    Purge all soft-deleted records that exceeded retention period.
    This is the main entry point for scheduled purge operations.
    
    Args:
        connection: Database connection object
    
    Returns:
        Dictionary with combined purge statistics
    """
    if not is_purge_enabled():
        logger.info("Automatic purge is disabled via ENABLE_AUTOMATIC_PURGE environment variable")
        return {
            'enabled': False,
            'message': 'Automatic purge is disabled'
        }
    
    logger.info("Starting automated purge of soft-deleted records")
    
    opportunities_result = purge_deleted_opportunities(connection)
    accounts_result = purge_deleted_accounts(connection)
    
    result = {
        'enabled': True,
        'opportunities': opportunities_result,
        'accounts': accounts_result,
        'total_purged': opportunities_result['purged_count'] + accounts_result['purged_count'],
        'timestamp': datetime.utcnow().isoformat()
    }
    
    logger.info(f"Completed automated purge: {result['total_purged']} total records purged")
    return result
