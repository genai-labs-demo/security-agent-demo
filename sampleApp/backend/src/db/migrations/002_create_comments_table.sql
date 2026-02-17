-- Migration: Create comments table
-- Requirements: 1.2, 1.4

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);

-- Create index on created_at for chronological ordering
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
