import { createApp } from './app';
import { loadConfig } from './config';
import { closeDatabasePool } from './db/pool';

/**
 * Backend application entry point
 * Starts the Express server
 */

const config = loadConfig();
const app = createApp(config);

const server = app.listen(config.port, () => {
  console.log('='.repeat(60));
  console.log('AWS Security Agent Demo Backend');
  console.log('='.repeat(60));
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Server listening on port ${config.port}`);
  console.log(`Database: ${config.database.host}:${config.database.port}/${config.database.database}`);
  console.log(`Cognito User Pool: ${config.cognito.userPoolId || 'Not configured'}`);
  console.log('='.repeat(60));
  console.log('⚠️  WARNING: This application contains intentional vulnerabilities');
  console.log('⚠️  For educational purposes only - DO NOT deploy to production');
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    console.log('HTTP server closed');
    await closeDatabasePool();
    console.log('Database pool closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT signal received: closing HTTP server');
  server.close(async () => {
    console.log('HTTP server closed');
    await closeDatabasePool();
    console.log('Database pool closed');
    process.exit(0);
  });
});
