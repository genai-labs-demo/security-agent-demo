-- Seed data: Sample comments for XSS testing
-- Requirements: 4.6, 5.4, 6.6

-- Insert sample comments (using user_id references)
INSERT INTO comments (user_id, content)
VALUES 
  (2, 'This is a great demo application! I learned so much about XSS vulnerabilities.'),
  (3, 'The educational messages are really helpful for understanding how these attacks work.'),
  (4, 'AWS Security Agent is an amazing tool for finding security issues automatically.'),
  (2, 'I tried the SQL injection demo and it really shows how dangerous unparameterized queries can be.'),
  (5, 'The command injection example is eye-opening. Always sanitize user input!'),
  (3, 'Great resource for learning about web security. The hands-on approach makes it easy to understand.')
ON CONFLICT DO NOTHING;
