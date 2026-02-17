import { Request, Response, NextFunction } from 'express';
import { AppConfig } from '../config';

/**
 * CORS middleware
 * Configures Cross-Origin Resource Sharing for CloudFront origin
 */

export function createCorsMiddleware(config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    
    // Allow configured origins or any origin in development
    if (config.nodeEnv === 'development' || !origin) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (config.cors.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    
    next();
  };
}
