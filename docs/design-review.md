# AnyCompany CRM — Architecture & Design Document

## 1. Overview

AnyCompany CRM is a full-stack web application built on AWS using CDK (TypeScript). It provides a customer relationship management system with an integrated security vulnerability testing platform for educational purposes. The application demonstrates common web security vulnerabilities (SQL injection, XSS, command injection) that can be detected by AWS Security Agent.

## 2. Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  CloudFront Distribution → S3 Static Website Hosting            │
│  Built with Vite, Cloudscape Design System                      │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway (REST)                           │
│  Cognito Authorizer │ WAF WebACL │ Request Validation            │
│  CORS configured    │ Rate limiting │ Managed rule groups         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Lambda Proxy Function                          │
│  Python 3.12 │ VPC-attached │ 1024MB │ 2min timeout              │
│  Routes: /accounts, /opportunities, /team-members,              │
│          /industries, /security/*                                │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data Layer                                    │
│  RDS PostgreSQL 15 │ RDS Proxy │ Secrets Manager                 │
│  Private Isolated Subnets │ Encrypted at rest                    │
│  S3 Bucket (images/assets) │ Server access logging               │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Infrastructure Components

### 3.1 Networking (VPC)
- CIDR: 10.0.0.0/16
- 3 Availability Zones
- Subnet tiers: Public (/24), Private with Egress (/24), Private Isolated (/28)
- 1 NAT Gateway
- VPC Flow Logs (REJECT traffic)
- Gateway Endpoints: S3, DynamoDB
- Security Group: HTTPS (443) from VPC CIDR, PostgreSQL (5432) self-referencing

### 3.2 Authentication & Authorization (Cognito)
- User Pool with email sign-in, password policy (8+ chars, upper/lower/digit/symbol)
- User Pool Groups: Admin, Users
- User Pool Client: SRP + admin auth flows, 8-hour token validity
- Identity Pool: authenticated access only, unauthenticated denied all actions
- Federated sign-in via OIDC (Midway)
- WAF WebACL on User Pool with managed rule groups

### 3.3 WAF Configuration
- Regional WebACL attached to both Cognito User Pool and API Gateway
- IP rate limiting: 3000 requests per 5 minutes
- Managed rule groups:
  - AWSManagedRulesCommonRuleSet (count mode)
  - AWSManagedRulesBotControlRuleSet (count mode)
  - AWSManagedRulesKnownBadInputsRuleSet (block mode)
  - AWSManagedRulesUnixRuleSet (block mode, body rule in count)
  - AWSManagedRulesSQLiRuleSet (block mode, body rule in count)
- NOTE: SQLi body and Unix shell body rules are in COUNT mode to allow vulnerability demonstrations

### 3.4 API Gateway (REST API)
- Cognito User Pool authorizer on all methods
- CORS: credentials allowed, configurable origins
- CloudWatch logging (ERROR level), metrics enabled
- Request body and parameter validation
- WAF WebACL association
- Single Lambda proxy integration handling all routes

### 3.5 Database (RDS PostgreSQL)
- Engine: PostgreSQL 15
- Storage: 100GB GP3, encrypted at rest
- Backup retention: 7 days
- Performance Insights enabled
- IAM authentication enabled
- Publicly accessible: false
- Located in Private Isolated subnets
- RDS Proxy for connection pooling (TLS not required — demo environment)
- Custom resource Lambda for database seeding

### 3.6 Storage (S3)
- Web-enabled bucket with CORS for allowed origins
- EventBridge notifications enabled
- Server access logging to dedicated logging bucket
- Asset deployment for CRM images

### 3.7 Frontend Deployment
- S3 static website hosting
- CloudFront distribution
- CodeBuild project for build pipeline (Vite/React)
- Custom resource trigger for automated builds on deploy

## 4. API Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | /accounts | accounts_handler | List all CRM accounts |
| GET | /accounts/{id} | accounts_handler | Get account by ID |
| GET | /opportunities | opportunities_handler | List opportunities |
| GET | /opportunities/{id} | opportunities_handler | Get opportunity by ID |
| GET | /team-members | team_members_handler | List team members |
| GET | /team-members/{id} | team_members_handler | Get team member by ID |
| GET | /industries | industries_handler | List industries |
| GET | /security/profiles | security_handler | List security profiles |
| GET | /security/profiles/{id} | security_handler | Get profile (SQL injection demo) |
| GET | /security/comments | security_handler | List comments |
| GET | /security/comments/search | security_handler | Search comments (XSS demo) |
| POST | /security/comments | security_handler | Create comment (stored XSS demo) |
| POST | /security/tools/ping | security_handler | Execute ping (command injection demo) |

## 5. Data Flow

1. User authenticates via Cognito (email/password or Midway federation)
2. Frontend receives JWT tokens (access, ID, refresh)
3. API requests include Authorization header with JWT
4. API Gateway validates JWT via Cognito authorizer
5. WAF evaluates request against rule groups
6. Lambda proxy receives event, routes to appropriate handler
7. Handler connects to RDS via Proxy using Secrets Manager credentials
8. Response returned through API Gateway with CORS headers

## 6. Security Considerations

### 6.1 Implemented Security Controls
- Cognito authentication with strong password policy
- WAF with rate limiting and managed rule groups
- VPC isolation (database in private isolated subnets)
- Encrypted storage (RDS, S3)
- Secrets Manager for database credentials
- CloudWatch logging and metrics
- VPC Flow Logs
- S3 server access logging
- IAM least-privilege (scoped Lambda permissions)

### 6.2 Intentional Vulnerabilities (Educational)
These are deliberately introduced for AWS Security Agent demonstration:

1. **SQL Injection** (`/security/profiles/{id}`): User input is concatenated directly into SQL queries without parameterization, allowing attackers to manipulate database queries.

2. **Cross-Site Scripting (XSS)**:
   - Reflected XSS (`/security/comments/search`): Search query is reflected in response without sanitization.
   - Stored XSS (`/security/comments` POST): Comment content is stored and rendered without escaping.
   - DOM-based and attribute-based XSS in frontend components.

3. **Command Injection** (`/security/tools/ping` POST): User-supplied hostname is passed directly to `os.system()` or subprocess without sanitization, allowing arbitrary command execution.

### 6.3 WAF Rule Exceptions
- SQLi body rule set to COUNT mode to allow SQL injection demonstrations
- Unix shell body rule set to COUNT mode to allow command injection demonstrations
- Common rule set in COUNT mode to avoid blocking demo traffic

## 7. Deployment

- CDK-managed infrastructure (TypeScript)
- Single-stage deployment (`dev`)
- CodeBuild for frontend builds triggered via CloudFormation custom resource
- Database seeding via Lambda custom resource
- cdk-nag for compliance checking (suppressions documented per resource)

## 8. Dependencies

### Backend
- Python 3.12 (Lambda runtime)
- psycopg2 (PostgreSQL driver)
- boto3 (AWS SDK)

### Frontend
- React 18+ with TypeScript
- Vite (build tool)
- Cloudscape Design System
- AWS Amplify UI (authentication)
- React Router (navigation)

### Infrastructure
- AWS CDK v2
- cdk-nag
- @aws-cdk/aws-lambda-python-alpha
