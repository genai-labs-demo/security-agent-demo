import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Database migration runner
 * Executes SQL migration files in order
 */
export async function runMigrations(pool: Pool): Promise<void> {
  const migrationsDir = path.join(__dirname, 'migrations');
  
  // Get all SQL files and sort them
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  console.log(`Found ${migrationFiles.length} migration files`);

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    
    console.log(`Running migration: ${file}`);
    
    try {
      await pool.query(sql);
      console.log(`✓ Migration ${file} completed successfully`);
    } catch (error) {
      console.error(`✗ Migration ${file} failed:`, error);
      throw error;
    }
  }

  console.log('All migrations completed successfully');
}

/**
 * Standalone migration execution
 * Run with: ts-node src/db/migrate.ts
 */
if (require.main === module) {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'vulnerable_demo',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  runMigrations(pool)
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration process failed:', error);
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}
