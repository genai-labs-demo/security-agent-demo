# Implementation Plan: AWS Security Agent Demo Application

## Overview

This implementation plan breaks down the educational vulnerable web application into discrete coding tasks. The application will be built using AWS CDK for infrastructure, Node.js/TypeScript for the backend, and vanilla HTML/CSS/JavaScript for the frontend. Each task builds incrementally toward a complete demo application showcasing SQL Injection, Command Injection, and XSS vulnerabilities.

## Tasks

- [x] 1. Initialize project structure and dependencies
  - Create root directory structure with separate folders for CDK infrastructure, backend application, and frontend
  - Initialize Node.js project with TypeScript configuration
  - Install AWS CDK dependencies and initialize CDK app
  - Install Express.js, PostgreSQL client, and AWS SDK dependencies
  - Set up testing framework (Jest and fast-check for property-based testing)
  - Create .gitignore and basic README
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Implement AWS CDK infrastructure stack
  - [x] 2.1 Create VPC and networking resources
    - Define VPC with public and private subnets
    - Configure security groups for RDS and application
    - _Requirements: 1.2, 1.4_
  
  - [x] 2.2 Create RDS PostgreSQL database
    - Define RDS instance with PostgreSQL 15
    - Configure database credentials in Secrets Manager
    - Set up security group allowing access from application
    - _Requirements: 1.2, 1.4_
  
  - [x] 2.3 Create Cognito User Pool
    - Define Cognito User Pool with username/password auth
    - Configure user pool client for web application
    - Create sample users for testing
    - _Requirements: 1.3, 3.1, 3.2, 3.3_
  
  - [x] 2.4 Create S3 bucket for static frontend
    - Define S3 bucket with website hosting configuration
    - Configure bucket policy for CloudFront access
    - _Requirements: 1.1, 1.5_
  
  - [x] 2.5 Create Application Load Balancer and EC2/ECS
    - Define ALB with target group
    - Create EC2 instance or ECS Fargate task for application
    - Configure security groups and IAM roles
    - _Requirements: 1.4, 1.5_
  
  - [x] 2.6 Create CloudFront distribution
    - Define CloudFront distribution with S3 and ALB origins
    - Configure cache behaviors for static assets and API routes
    - Set up HTTPS with AWS-managed certificate
    - _Requirements: 1.1, 1.5_
  
  - [ ]* 2.7 Write unit tests for CDK stack
    - Test that all resources are created with correct configurations
    - Test security group rules
    - Test IAM policies
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. Set up database schema and seed data
  - [x] 3.1 Create database migration scripts
    - Write SQL migration for users table
    - Write SQL migration for comments table
    - Write SQL migration for vulnerability_info table
    - _Requirements: 1.2, 1.4_
  
  - [x] 3.2 Create seed data for educational content
    - Insert vulnerability information for SQL Injection
    - Insert vulnerability information for Command Injection
    - Insert vulnerability information for XSS
    - Insert sample users and comments
    - _Requirements: 4.6, 5.4, 6.6_
  
  - [ ]* 3.3 Write unit tests for database schema
    - Test table creation
    - Test foreign key constraints
    - Test seed data insertion
    - _Requirements: 1.2, 1.4_

- [x] 4. Implement backend API core and authentication
  - [x] 4.1 Create Express.js application setup
    - Initialize Express app with middleware
    - Configure CORS for CloudFront origin
    - Set up request logging
    - Create database connection pool
    - _Requirements: 1.4, 1.5_
  
  - [x] 4.2 Implement Cognito authentication integration
    - Create authentication middleware to verify JWT tokens
    - Implement POST /api/auth/login endpoint
    - Handle Cognito token validation
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 4.3 Implement preflight validator endpoint
    - Create GET /api/health endpoint
    - Check RDS database connectivity
    - Check Cognito configuration
    - Return structured health status JSON
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [ ]* 4.4 Write unit tests for authentication
    - Test login with valid credentials
    - Test login with invalid credentials
    - Test JWT token validation
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ]* 4.5 Write unit tests for preflight validator
    - Test health endpoint with healthy infrastructure
    - Test health endpoint with database connection failure
    - Test error message formatting
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5. Checkpoint - Ensure infrastructure and core API work
  - Deploy CDK stack to AWS
  - Verify all resources are created successfully
  - Test preflight validator endpoint
  - Test authentication with Cognito
  - Ensure all tests pass, ask the user if questions arise

- [x] 6. Implement SQL Injection vulnerability
  - [x] 6.1 Create vulnerable profile endpoint
    - Implement GET /api/profile/:userId with SQL injection vulnerability
    - Construct SQL query using string concatenation (no parameterization)
    - Return user profile data directly from query results
    - Include database error messages in response
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 6.2 Add educational message response
    - Detect successful SQL injection attempts
    - Return educational message explaining the vulnerability
    - Include sample payloads and detection information
    - _Requirements: 6.5_
  
  - [ ]* 6.3 Write property test for SQL injection
    - **Property 6: SQL injection allows query manipulation**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
    - Generate various SQL injection payloads
    - Test that queries can be manipulated
    - Test authentication bypass scenarios
    - Test data extraction scenarios
  
  - [ ]* 6.4 Write property test for educational messages
    - **Property 7: Educational messages display on exploit**
    - **Validates: Requirements 6.5**
    - Test that successful SQL injection returns educational content
    - Verify message format and content

- [x] 7. Implement Command Injection vulnerability
  - [x] 7.1 Create vulnerable ping tool endpoint
    - Implement POST /api/tools/ping with command injection vulnerability
    - Execute system ping command with unsanitized user input
    - Return command output directly in response
    - _Requirements: 5.1, 5.2_
  
  - [x] 7.2 Add educational message response
    - Detect successful command injection attempts
    - Return educational message explaining the vulnerability
    - Include sample payloads and detection information
    - _Requirements: 5.3_
  
  - [ ]* 7.3 Write property test for command injection
    - **Property 5: Command injection executes arbitrary commands**
    - **Validates: Requirements 5.1, 5.2**
    - Generate various command injection payloads
    - Test that arbitrary commands can be executed
    - Test command chaining and piping
  
  - [ ]* 7.4 Write property test for educational messages
    - **Property 7: Educational messages display on exploit** (continued)
    - **Validates: Requirements 5.3**
    - Test that successful command injection returns educational content

- [x] 8. Implement XSS vulnerabilities
  - [x] 8.1 Create vulnerable comments endpoints
    - Implement POST /api/comments to store comments without sanitization
    - Implement GET /api/comments to retrieve and display comments without encoding
    - Store user input directly in database
    - _Requirements: 4.1, 4.2_
  
  - [x] 8.2 Create vulnerable search endpoint for reflected XSS
    - Implement GET /api/search with query parameter
    - Reflect search query in response without sanitization
    - _Requirements: 4.1_
  
  - [x] 8.3 Add educational message responses
    - Detect successful XSS attempts
    - Return educational messages for different XSS types
    - Include sample payloads and detection information
    - _Requirements: 4.5_
  
  - [ ]* 8.4 Write property test for reflected XSS
    - **Property 1: Reflected XSS renders unsanitized input**
    - **Validates: Requirements 4.1**
    - Generate various XSS payloads
    - Test that input is reflected without sanitization
  
  - [ ]* 8.5 Write property test for stored XSS
    - **Property 2: Stored XSS persists and renders unsanitized**
    - **Validates: Requirements 4.2**
    - Generate various XSS payloads
    - Test that stored content is displayed without encoding
  
  - [ ]* 8.6 Write property test for educational messages
    - **Property 7: Educational messages display on exploit** (continued)
    - **Validates: Requirements 4.5**
    - Test that successful XSS returns educational content

- [-] 9. Implement frontend application
  - [x] 9.1 Create login page
    - Build HTML login form
    - Implement JavaScript for Cognito authentication
    - Handle login success and error states
    - _Requirements: 3.1, 3.2_
  
  - [x] 9.2 Create dashboard page
    - Build main dashboard with navigation
    - Display links to vulnerability demos
    - Show preflight validation status
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 9.3 Create profile page with SQL injection demo
    - Build user profile search interface
    - Display vulnerability information and sample payloads
    - Show educational messages on successful exploit
    - _Requirements: 6.1, 6.5, 6.6_
  
  - [x] 9.4 Create comments page with XSS demo
    - Build comment submission and display interface
    - Display vulnerability information and sample payloads
    - Show educational messages on successful exploit
    - _Requirements: 4.1, 4.2, 4.5, 4.6_
  
  - [x] 9.5 Create tools page with command injection demo
    - Build ping tool interface
    - Display vulnerability information and sample payloads
    - Show educational messages on successful exploit
    - _Requirements: 5.1, 5.3, 5.4_
  
  - [x] 9.6 Implement DOM-based and attribute-based XSS demos
    - Add client-side JavaScript that manipulates DOM with user input
    - Add examples of attribute injection
    - Display educational content
    - _Requirements: 4.3, 4.4_
  
  - [ ]* 9.7 Write property tests for DOM-based XSS
    - **Property 3: DOM-based XSS executes client-side scripts**
    - **Validates: Requirements 4.3**
    - Test that DOM manipulation allows script execution
  
  - [ ]* 9.8 Write property tests for attribute-based XSS
    - **Property 4: Attribute-based XSS allows injection**
    - **Validates: Requirements 4.4**
    - Test that attribute injection allows script execution

- [x] 10. Add styling and educational content
  - [x] 10.1 Create CSS styling
    - Design clean, educational interface
    - Style vulnerability information sections
    - Style educational messages
    - Add warning banners about intentional vulnerabilities
  
  - [x] 10.2 Add comprehensive educational content
    - Write detailed vulnerability descriptions
    - Add "Why It's Dangerous" sections
    - Add "How to Fix It" guidance
    - Add "How AWS Security Agent Detects It" explanations
    - _Requirements: 4.6, 5.4, 6.6_

- [x] 11. Final integration and deployment
  - [x] 11.1 Build and deploy frontend to S3
    - Build frontend assets
    - Upload to S3 bucket
    - Invalidate CloudFront cache
    - _Requirements: 1.1, 1.5_
  
  - [x] 11.2 Deploy backend application
    - Build backend application
    - Deploy to EC2/ECS
    - Configure environment variables
    - _Requirements: 1.4, 1.5_
  
  - [x] 11.3 Run end-to-end validation
    - Test complete user flow through CloudFront
    - Verify all vulnerabilities work as expected
    - Verify educational messages display correctly
    - Test with AWS Security Agent if available

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Run all unit tests
  - Run all property-based tests
  - Verify deployment is successful
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate that vulnerabilities work across all inputs
- Unit tests validate specific examples and infrastructure setup
- The application is intentionally vulnerable and should only be deployed in isolated test environments
