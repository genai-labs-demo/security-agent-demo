/**
 * Application configuration
 * Loads configuration from environment variables
 */

export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  cognito: {
    userPoolId: string;
    clientId: string;
    region: string;
  };
  cors: {
    allowedOrigins: string[];
  };
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'vulnerabledemodb',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
    cognito: {
      userPoolId: process.env.USER_POOL_ID || '',
      clientId: process.env.USER_POOL_CLIENT_ID || '',
      region: process.env.AWS_REGION || 'us-east-1',
    },
    cors: {
      allowedOrigins: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',')
        : ['http://localhost:3000', 'http://localhost:8080'],
    },
  };
}
