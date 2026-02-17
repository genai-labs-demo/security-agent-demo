import { Router, Request, Response } from 'express';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { AppConfig } from '../config';

/**
 * Authentication routes
 * Handles user login with AWS Cognito
 */

export function createAuthRouter(config: AppConfig): Router {
  const router = Router();
  
  // Create Cognito client
  const cognitoClient = new CognitoIdentityProviderClient({
    region: config.cognito.region,
  });

  /**
   * POST /api/auth/login
   * Authenticates user with Cognito and returns JWT tokens
   */
  router.post('/login', async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, password } = req.body;

      // Validate input
      if (!username || !password) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Username and password are required',
        });
        return;
      }

      // Authenticate with Cognito using USER_PASSWORD_AUTH flow
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: config.cognito.clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      });

      const response = await cognitoClient.send(command);

      // Check if authentication was successful
      if (!response.AuthenticationResult) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication failed',
        });
        return;
      }

      // Return tokens to client
      res.json({
        success: true,
        message: 'Login successful',
        tokens: {
          accessToken: response.AuthenticationResult.AccessToken,
          idToken: response.AuthenticationResult.IdToken,
          refreshToken: response.AuthenticationResult.RefreshToken,
          expiresIn: response.AuthenticationResult.ExpiresIn,
        },
      });
    } catch (error: any) {
      console.error('Login error:', error);

      // Handle specific Cognito errors
      if (error.name === 'NotAuthorizedException') {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid username or password',
        });
        return;
      }

      if (error.name === 'UserNotFoundException') {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid username or password',
        });
        return;
      }

      if (error.name === 'UserNotConfirmedException') {
        res.status(403).json({
          error: 'Forbidden',
          message: 'User account is not confirmed',
        });
        return;
      }

      // Generic error response
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An error occurred during authentication',
      });
    }
  });

  return router;
}
