import { config } from 'dotenv';
import { Pool } from 'pg';
import { runMigrations } from './migrate';
import { runSeeds } from './seed';

// Load environment variables from .env file
config();

/**
 * Complete database setup
 * Runs migrations followed by seed data
 */
export async function setupDatabase(pool: Pool): Promise<void> {
  console.log('Starting database setup...\n');
  
  try {
    // Run migrations first
    console.log('=== Running Migrations ===');
    await runMigrations(pool);
    console.log('');
    
    // Then run seeds
    console.log('=== Running Seeds ===');
    await runSeeds(pool);
    console.log('');
    
    console.log('✓ Database setup completed successfully');
  } catch (error) {
    console.error('✗ Database setup failed:', error);
    throw error;
  }
}

/**
 * Standalone setup execution
 * Run with: ts-node src/db/setup.ts
 */
if (require.main === module) {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'vulnerable_demo',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  setupDatabase(pool)
    .then(() => {
      console.log('Setup process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Setup process failed:', error);
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}
