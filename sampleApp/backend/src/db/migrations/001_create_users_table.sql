-- Migration: Create users table
-- Requirements: 1.2, 1.4

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  cognito_id VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  bio TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on cognito_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_cognito_id ON users(cognito_id);

-- Create index on username for search functionality
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
