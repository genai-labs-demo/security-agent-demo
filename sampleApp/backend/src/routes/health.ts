import { Router, Request, Response } from 'express';
import { getDatabasePool } from '../db/pool';
import {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { AppConfig } from '../config';

/**
 * Health check and preflight validation routes
 * Validates infrastructure setup and component connectivity
 */

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  checks: {
    database: {
      status: 'ok' | 'failed';
      message?: string;
      error?: string;
    };
    cognito: {
      status: 'ok' | 'failed';
      message?: string;
      error?: string;
    };
  };
  timestamp: string;
}

export function createHealthRouter(config: AppConfig): Router {
  const router = Router();

  /**
   * GET /api/health
   * Preflight validator endpoint
   * Checks RDS database connectivity and Cognito configuration
   */
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const result: HealthCheckResult = {
      status: 'healthy',
      checks: {
        database: { status: 'ok' },
        cognito: { status: 'ok' },
      },
      timestamp: new Date().toISOString(),
    };

    // Check database connectivity
    try {
      const pool = getDatabasePool();
      const client = await pool.connect();
      
      // Execute a simple query to verify connection
      await client.query('SELECT 1');
      client.release();
      
      result.checks.database.status = 'ok';
      result.checks.database.message = 'Database connection successful';
    } catch (error: any) {
      console.error('Database health check failed:', error);
      result.status = 'unhealthy';
      result.checks.database.status = 'failed';
      result.checks.database.error = error.message || 'Database connection failed';
    }

    // Check Cognito configuration
    try {
      if (!config.cognito.userPoolId) {
        throw new Error('Cognito User Pool ID not configured');
      }

      const cognitoClient = new CognitoIdentityProviderClient({
        region: config.cognito.region,
      });

      const command = new DescribeUserPoolCommand({
        UserPoolId: config.cognito.userPoolId,
      });

      await cognitoClient.send(command);
      
      result.checks.cognito.status = 'ok';
      result.checks.cognito.message = 'Cognito User Pool accessible';
    } catch (error: any) {
      console.error('Cognito health check failed:', error);
      result.status = 'unhealthy';
      result.checks.cognito.status = 'failed';
      result.checks.cognito.error = error.message || 'Cognito configuration check failed';
    }

    // Return appropriate status code
    const statusCode = result.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(result);
  });

  return router;
}
