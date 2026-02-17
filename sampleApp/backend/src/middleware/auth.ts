import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { AppConfig } from '../config';

/**
 * Authentication middleware
 * Verifies JWT tokens from AWS Cognito
 */

// Extend Express Request type to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        username: string;
        email?: string;
      };
    }
  }
}

export function createAuthMiddleware(config: AppConfig) {
  // Create JWT verifier for Cognito User Pool
  const verifier = CognitoJwtVerifier.create({
    userPoolId: config.cognito.userPoolId,
    tokenUse: 'access',
    clientId: config.cognito.clientId,
  });

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing or invalid Authorization header',
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify the JWT token
      const payload = await verifier.verify(token);

      // Attach user information to request
      req.user = {
        sub: payload.sub,
        username: payload.username || payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
      };

      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }
  };
}
