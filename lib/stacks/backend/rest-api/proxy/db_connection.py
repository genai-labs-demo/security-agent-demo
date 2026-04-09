"""
Database connection module for RDS Postgres integration.
Handles credential retrieval and database connections.
Relies on RDS Proxy for connection pooling and management.
"""

import os
import json
import logging
from typing import Optional
import boto3
import psycopg2
from botocore.exceptions import ClientError

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def _get_database_credentials() -> dict:
    """
    Retrieve database credentials from AWS Secrets Manager.
    Credentials are fetched on each call to ensure freshness and support rotation.
    Boto3 client implements its own caching for performance.
    
    Returns:
        dict: Database credentials containing username, password, host, port, dbname
    
    Raises:
        Exception: If credentials cannot be retrieved from Secrets Manager
    """
    global _db_credentials
    if not secret_arn:
        raise ValueError("DATABASE_SECRET_ARN environment variable not set")
    
    logger.info(f"Retrieving database credentials from Secrets Manager: {secret_arn}")
    
    try:
        # Create Secrets Manager client
        session = boto3.session.Session()
        client = session.client(service_name='secretsmanager')
        
        # Retrieve secret value
        response = client.get_secret_value(SecretId=secret_arn)
        
        # Parse secret string
        secret_string = response['SecretString']
        secret_dict = json.loads(secret_string)
        
        # Extract credentials
        database_proxy_endpoint = os.environ.get('DATABASE_PROXY_ENDPOINT')
        database_name = os.environ.get('DATABASE_NAME')
        
        if not database_proxy_endpoint or not database_name:
            raise ValueError("DATABASE_PROXY_ENDPOINT or DATABASE_NAME environment variable not set")
        
        _db_credentials = {
        credentials = {
            'password': secret_dict.get('password'),
            'host': database_proxy_endpoint,
            'port': int(os.environ.get('DATABASE_PORT', secret_dict.get('port', 5432))),
            'dbname': database_name
        }
        
        logger.info(f"Successfully retrieved credentials for database: {database_name}")
        return _db_credentials
        return credentials
    except ClientError as e:
        logger.error(f"Failed to retrieve database credentials: {str(e)}")
        raise Exception(f"Failed to retrieve database credentials: {str(e)}")
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse secret JSON: {str(e)}")
        raise Exception(f"Failed to parse secret JSON: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error retrieving credentials: {str(e)}")
        raise


def _initialize_connection_pool() -> psycopg2.pool.SimpleConnectionPool:
    """
    Get a database connection from the connection pool.
    Create a new database connection.
    
    This function creates a direct connection to the database through RDS Proxy.
    RDS Proxy handles connection pooling, multiplexing, and failover at the
    infrastructure level, eliminating the need for application-level pooling.
    
    Each Lambda invocation creates its own connection which is closed after use.
    This approach:
    - Eliminates global state and race conditions
    - Supports credential rotation (fresh credentials on each call)
    - Prevents connection pool exhaustion in high-concurrency scenarios
    - Simplifies code while maintaining performance through RDS Proxy
    This function should be called to obtain a connection for database operations.
    The connection is retrieved from a pool that persists across Lambda invocations,
    Returns:
        psycopg2.connection: Database connection object
    
    Raises:
        Exception: If connection cannot be obtained from the pool
    
    Example:
        conn = get_database_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM accounts")
            results = cursor.fetchall()
        finally:
            return_database_connection(conn)  # This will close the connection
    """
    try:
        # Get fresh database credentials
        credentials = _get_database_credentials()
        
        logger.info("Creating new database connection")
        
        # Create direct connection (RDS Proxy handles pooling)
        connection = psycopg2.connect(
            user=credentials['username'],
            password=credentials['password'],
            host=credentials['host'],
            port=credentials['port'],
            database=credentials['dbname'],
            connect_timeout=10
        )
        
        logger.info("Database connection created successfully")
        return connection
        
    except psycopg2.Error as e:
        logger.error(f"Failed to create database connection: {str(e)}")
        raise Exception(f"Failed to create database connection: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error creating database connection: {str(e)}")
        raise


def return_database_connection(connection) -> None:
    """
    Close a database connection.
    Should be called after database operations are complete.
    
    Args:
        connection: Database connection to close
    """
    if connection is not None:
        try:
            connection.close()
            logger.info("Database connection closed")
        except Exception as e:
            logger.error(f"Failed to close database connection: {str(e)}")
