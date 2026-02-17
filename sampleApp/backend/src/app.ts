import express, { Express, Request, Response } from 'express';
import { AppConfig } from './config';
import { createDatabasePool } from './db/pool';
import { requestLogger } from './middleware/logger';
import { createCorsMiddleware } from './middleware/cors';
import { createAuthRouter } from './routes/auth';
import { createHealthRouter } from './routes/health';
import { createProfileRouter } from './routes/profile';
import { createToolsRouter } from './routes/tools';
import { createCommentsRouter } from './routes/comments';
import { createSearchRouter } from './routes/search';

/**
 * Create and configure Express application
 */

export function createApp(config: AppConfig): Express {
  const app = express();
  
  // Initialize database connection pool
  createDatabasePool(config);
  
  // Middleware setup
  app.use(express.json()); // Parse JSON request bodies
  app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
  app.use(requestLogger); // Log all requests
  app.use(createCorsMiddleware(config)); // Configure CORS
  
  // Basic route for testing
  app.get('/', (req: Request, res: Response) => {
    res.json({
      message: 'AWS Security Agent Demo API',
      status: 'running',
      warning: '⚠️ This application contains intentional security vulnerabilities for educational purposes only',
    });
  });
  
  // Authentication routes (task 4.2)
  app.use('/api/auth', createAuthRouter(config));
  
  // Health check endpoint (task 4.3)
  app.use('/api/health', createHealthRouter(config));
  
  // Profile endpoint with SQL injection vulnerability (task 6.1, 6.2)
  app.use('/api/profile', createProfileRouter(config));
  
  // Tools endpoint with command injection vulnerability (task 7.1, 7.2)
  app.use('/api/tools', createToolsRouter(config));
  
  // Comments endpoints with XSS vulnerability (task 8.1)
  app.use('/api/comments', createCommentsRouter(config));
  
  // Search endpoint with reflected XSS vulnerability (task 8.2)
  app.use('/api/search', createSearchRouter(config));
  
  // Routes to be added in subsequent tasks
  // - XSS vulnerability demo endpoints (task 8)
  
  return app;
}
