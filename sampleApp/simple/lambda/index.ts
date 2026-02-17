/**
 * AWS Security Agent Demo - Simplified Lambda Backend
 * Single file containing all API routes with intentional vulnerabilities
 */

import { Handler } from 'aws-lambda';
import { Pool } from 'pg';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { execSync } from 'child_process';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// Secrets Manager client
const secretsClient = new SecretsManagerClient({});

// Database credentials cache
let dbCredentials: { username: string; password: string } | null = null;

// Get database credentials from Secrets Manager
async function getDbCredentials() {
  if (dbCredentials) return dbCredentials;
  
  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN })
  );
  
  const secret = JSON.parse(response.SecretString!);
  dbCredentials = { username: secret.username, password: secret.password };
  return dbCredentials;
}

// Database connection pool (initialized lazily)
let pool: Pool | null = null;
let dbInitialized = false;

async function getPool() {
  if (pool) return pool;
  
  const creds = await getDbCredentials();
  pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: creds.username,
    password: creds.password,
    max: 5,
    ssl: {
      rejectUnauthorized: false, // Required for RDS
    },
  });
  
  return pool;
}

// Initialize database tables and seed data
async function initializeDatabase() {
  if (dbInitialized) return;
  
  const dbPool = await getPool();
  
  try {
    // Create users table
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100),
        role VARCHAR(20) DEFAULT 'user',
        bio TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create comments table
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insert sample users (if not exists)
    await dbPool.query(`
      INSERT INTO users (username, email, role, bio) VALUES
      ('demouser', 'demo@example.com', 'user', 'Demo user account'),
      ('admin', 'admin@example.com', 'admin', 'Administrator account'),
      ('alice', 'alice@example.com', 'user', 'Regular user'),
      ('bob', 'bob@example.com', 'user', 'Another user')
      ON CONFLICT (username) DO NOTHING
    `);
    
    // Check if we need to seed comments
    const commentCount = await dbPool.query('SELECT COUNT(*) FROM comments');
    if (parseInt(commentCount.rows[0].count) === 0) {
      await dbPool.query(`
        INSERT INTO comments (user_id, content) VALUES
        (1, 'This is a normal comment'),
        (2, 'Welcome to the demo!'),
        (3, 'Testing the comment system')
      `);
    }
    
    dbInitialized = true;
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    // Don't throw - let the app continue, it will retry on next invocation
  }
}

// Cognito JWT verifier
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID!,
  tokenUse: 'access',
  clientId: process.env.USER_POOL_CLIENT_ID!,
});

// Simple router
export const handler: Handler = async (event) => {
  // Handle both API Gateway and Function URL event formats
  const rawPath = event.rawPath || event.path || event.requestContext?.http?.path;
  const method = event.requestContext?.http?.method || event.httpMethod || event.requestContext?.httpMethod;
  const body = event.body;
  const queryStringParameters = event.queryStringParameters;

  // Initialize database on first request
  await initializeDatabase();

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Route: Health Check
    if ((rawPath === '/api/health' || rawPath === '/health') && method === 'GET') {
      const dbCheck = await checkDatabase();
      const cognitoCheck = checkCognito();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: dbCheck && cognitoCheck ? 'healthy' : 'unhealthy',
          checks: {
            database: dbCheck ? { status: 'ok', message: 'Connected' } : { status: 'error', error: 'Not connected' },
            cognito: cognitoCheck ? { status: 'ok', message: 'Configured' } : { status: 'error', error: 'Not configured' },
          },
        }),
      };
    }

    // Route: SQL Injection - Profile Lookup
    if ((rawPath.startsWith('/api/profile/') || rawPath.startsWith('/profile/')) && method === 'GET') {
      const userIdRaw = rawPath.split('/')[rawPath.startsWith('/api') ? 3 : 2];
      const userId = decodeURIComponent(userIdRaw);
      const dbPool = await getPool();
      
      // INTENTIONALLY VULNERABLE: String concatenation in SQL query
      const query = `SELECT id, username, email, role, bio FROM users WHERE id = ${userId}`;
      
      try {
        const result = await dbPool.query(query);
        
        // Detect SQL injection attempts
        const isInjection = userId.includes("'") || userId.includes('--') || userId.includes('UNION');
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: result.rows,
            ...(isInjection && {
              educational: {
                vulnerability: 'SQL Injection',
                message: '🚨 SQL Injection Detected!',
                what_happened: 'Your input was directly concatenated into the SQL query without parameterization, allowing you to manipulate the query structure.',
                how_to_fix: 'Use parameterized queries: SELECT * FROM users WHERE id = $1',
                how_agent_detects: 'AWS Security Agent tests various SQL injection payloads and analyzes query patterns to detect this vulnerability.',
                sample_payloads: ["' OR '1'='1", "admin' --", "' UNION SELECT * FROM users --"],
              },
            }),
          }),
        };
      } catch (error: any) {
        // INTENTIONALLY VULNERABLE: Expose database errors
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: error.message,
            educational: {
              vulnerability: 'SQL Injection',
              message: 'Database error exposed - this reveals schema information!',
            },
          }),
        };
      }
    }

    // Route: XSS - Get Comments (Stored XSS)
    if ((rawPath === '/api/comments' || rawPath === '/comments') && method === 'GET') {
      const dbPool = await getPool();
      const result = await dbPool.query('SELECT * FROM comments ORDER BY created_at DESC');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: result.rows,
          educational: {
            vulnerability: 'Stored XSS',
            message: 'Comments are returned without sanitization - scripts will execute in the browser!',
          },
        }),
      };
    }

    // Route: XSS - Post Comment (Stored XSS)
    if ((rawPath === '/api/comments' || rawPath === '/comments') && method === 'POST') {
      const { content, user_id } = JSON.parse(body || '{}');
      const dbPool = await getPool();
      
      // INTENTIONALLY VULNERABLE: No input sanitization
      const result = await dbPool.query(
        'INSERT INTO comments (user_id, content) VALUES ($1, $2) RETURNING *',
        [user_id || 1, content]
      );
      
      const isXSS = content.includes('<script>') || content.includes('onerror=') || content.includes('onload=');
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          data: result.rows[0],
          ...(isXSS && {
            educational: {
              vulnerability: 'Stored XSS',
              message: '🚨 XSS Payload Stored!',
              what_happened: 'Your malicious script was stored in the database without sanitization and will execute when displayed.',
              how_to_fix: 'Sanitize input on storage and encode output when displaying: &lt;script&gt; instead of <script>',
              how_agent_detects: 'AWS Security Agent submits various XSS payloads and checks if they execute in the rendered page.',
            },
          }),
        }),
      };
    }

    // Route: Command Injection - Ping Tool
    if ((rawPath === '/api/tools/ping' || rawPath === '/tools/ping') && method === 'POST') {
      const { host } = JSON.parse(body || '{}');
      
      // INTENTIONALLY VULNERABLE: Unsanitized command execution
      try {
        const command = `ping -c 4 ${host}`;
        const output = execSync(command, { encoding: 'utf-8', timeout: 5000 });
        
        const isInjection = host.includes(';') || host.includes('&&') || host.includes('|');
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            output,
            ...(isInjection && {
              educational: {
                vulnerability: 'Command Injection',
                message: '🚨 Command Injection Detected!',
                what_happened: 'Your input was directly passed to a shell command, allowing you to execute arbitrary commands.',
                how_to_fix: 'Validate and sanitize input, use allowlists, or avoid shell execution entirely.',
                how_agent_detects: 'AWS Security Agent tests command injection payloads like ; ls, && whoami, | cat /etc/passwd',
                sample_payloads: ['127.0.0.1; ls -la', '127.0.0.1 && whoami', '127.0.0.1 | cat /etc/passwd'],
              },
            }),
          }),
        };
      } catch (error: any) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            error: error.message,
            output: error.stdout || error.stderr,
          }),
        };
      }
    }

    // Route not found
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' }),
    };

  } catch (error: any) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Helper: Check database connection
async function checkDatabase(): Promise<boolean> {
  try {
    const dbPool = await getPool();
    await dbPool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// Helper: Check Cognito configuration
function checkCognito(): boolean {
  return !!(process.env.USER_POOL_ID && process.env.USER_POOL_CLIENT_ID);
}
