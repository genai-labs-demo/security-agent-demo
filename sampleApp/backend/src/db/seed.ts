import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Database seed data runner
 * Executes SQL seed files in order
 */
export async function runSeeds(pool: Pool): Promise<void> {
  const seedsDir = path.join(__dirname, 'seeds');
  
  // Get all SQL files and sort them
  const seedFiles = fs.readdirSync(seedsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  console.log(`Found ${seedFiles.length} seed files`);

  for (const file of seedFiles) {
    const filePath = path.join(seedsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    
    console.log(`Running seed: ${file}`);
    
    try {
      await pool.query(sql);
      console.log(`✓ Seed ${file} completed successfully`);
    } catch (error) {
      console.error(`✗ Seed ${file} failed:`, error);
      throw error;
    }
  }

  console.log('All seeds completed successfully');
}

/**
 * Standalone seed execution
 * Run with: ts-node src/db/seed.ts
 */
if (require.main === module) {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'vulnerable_demo',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  runSeeds(pool)
    .then(() => {
      console.log('Seed process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed process failed:', error);
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}
