-- Seed data: Sample users for testing
-- Requirements: 4.6, 5.4, 6.6

-- Insert sample users
-- Note: cognito_id values are placeholders and should be replaced with actual Cognito user IDs after user pool creation
INSERT INTO users (cognito_id, username, email, role, bio)
VALUES 
  ('demo-user-1', 'admin', 'admin@example.com', 'admin', 'System administrator account for testing SQL injection vulnerabilities.'),
  ('demo-user-2', 'alice', 'alice@example.com', 'user', 'Regular user account. Loves cybersecurity and learning about vulnerabilities.'),
  ('demo-user-3', 'bob', 'bob@example.com', 'user', 'Software developer interested in secure coding practices.'),
  ('demo-user-4', 'charlie', 'charlie@example.com', 'user', 'Security researcher exploring AWS Security Agent capabilities.'),
  ('demo-user-5', 'demo', 'demo@example.com', 'user', 'Demo account for testing purposes.')
ON CONFLICT (cognito_id) DO NOTHING;
