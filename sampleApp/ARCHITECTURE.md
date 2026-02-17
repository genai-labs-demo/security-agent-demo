# Architecture Overview

This document describes the architecture of the AWS Security Agent Demo Application.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           Internet                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS
                             ▼
                    ┌────────────────┐
                    │   CloudFront   │
                    │  Distribution  │
                    └────────┬───────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
         ┌──────────┐            ┌──────────────┐
         │    S3    │            │     ALB      │
         │  Bucket  │            │ (Port 80)    │
         │(Frontend)│            └──────┬───────┘
         └──────────┘                   │
                                        │
                                        ▼
                              ┌─────────────────┐
                              │   ECS Fargate   │
                              │   (Backend)     │
                              └────────┬────────┘
                                       │
                        ┌──────────────┼──────────────┐
                        │              │              │
                        ▼              ▼              ▼
                  ┌──────────┐  ┌──────────┐  ┌──────────┐
                  │   RDS    │  │ Cognito  │  │ Secrets  │
                  │PostgreSQL│  │User Pool │  │ Manager  │
                  └──────────┘  └──────────┘  └──────────┘
```

## Components

### 1. CloudFront Distribution

**Purpose**: CDN and entry point for the application

**Configuration**:
- Origin 1: S3 bucket (static assets)
  - Path patterns: `/`, `/pages/*`, `/assets/*`
  - Cache behavior: Cache static assets
- Origin 2: Application Load Balancer (API)
  - Path pattern: `/api/*`
  - Cache behavior: No caching for API requests

**Features**:
- HTTPS only (redirects HTTP to HTTPS)
- AWS-managed SSL certificate
- Origin Access Identity for S3
- Custom error responses (404 → index.html)

### 2. S3 Bucket

**Purpose**: Hosts static frontend files

**Contents**:
- `index.html` - Entry point
- `pages/*.html` - Application pages
- `assets/*.css` - Stylesheets
- `assets/*.js` - JavaScript files

**Security**:
- Block all public access
- CloudFront access via Origin Access Identity
- Encryption at rest (AES256)

### 3. Application Load Balancer (ALB)

**Purpose**: Routes traffic to backend containers

**Configuration**:
- Internet-facing
- HTTP listener on port 80
- Target group: ECS Fargate tasks on port 3000
- Health check: `/api/health`

**Security Groups**:
- Inbound: Port 80 from anywhere (CloudFront)
- Outbound: All traffic

### 4. ECS Fargate

**Purpose**: Runs containerized backend application

**Configuration**:
- Cluster: `vulnerable-demo-cluster`
- Service: Fargate service with 1 task
- Task definition:
  - CPU: 256 (0.25 vCPU)
  - Memory: 512 MB
  - Container: Node.js backend
  - Port: 3000

**Environment Variables**:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `USER_POOL_ID`, `USER_POOL_CLIENT_ID`
- `AWS_REGION`
- `NODE_ENV`

**Networking**:
- Private subnets (no public IP)
- NAT Gateway for outbound internet access
- Security group allows traffic from ALB

### 5. RDS PostgreSQL

**Purpose**: Stores application data

**Configuration**:
- Engine: PostgreSQL 15
- Instance: db.t3.micro
- Storage: 20 GB (auto-scaling to 100 GB)
- Single-AZ deployment

**Database Schema**:
- `users` - User profiles
- `comments` - User comments (for XSS demo)
- `vulnerability_info` - Educational content

**Security**:
- Private subnets (not publicly accessible)
- Security group allows traffic from ECS tasks only
- Credentials stored in Secrets Manager
- Encryption at rest

### 6. Cognito User Pool

**Purpose**: User authentication and session management

**Configuration**:
- Sign-in: Username and password
- No MFA (for simplicity)
- Password policy: 8+ chars, upper, lower, digits
- Pre-created users: `demouser`, `admin`

**Integration**:
- Frontend: Cognito JavaScript SDK
- Backend: JWT token verification

### 7. Secrets Manager

**Purpose**: Stores database credentials securely

**Contents**:
- Database username: `dbadmin`
- Database password: Auto-generated

**Access**:
- ECS task role has read permission
- Backend retrieves credentials at runtime

### 8. VPC

**Purpose**: Network isolation and security

**Configuration**:
- 2 Availability Zones
- Public subnets: ALB, NAT Gateway
- Private subnets: ECS tasks, RDS
- 1 NAT Gateway for outbound traffic

**Security Groups**:
- ALB: Allows HTTP from internet
- ECS: Allows traffic from ALB
- RDS: Allows PostgreSQL from ECS

## Data Flow

### 1. User Access Flow

```
User → CloudFront → S3 → Browser
                 ↓
              index.html
                 ↓
           Redirect to login
```

### 2. Authentication Flow

```
User → Login Form → Cognito SDK → Cognito User Pool
                                        ↓
                                   JWT Token
                                        ↓
                                   Store in localStorage
```

### 3. API Request Flow

```
Browser → CloudFront → ALB → ECS Task → Backend API
                                              ↓
                                    Verify JWT (Cognito)
                                              ↓
                                    Query Database (RDS)
                                              ↓
                                    Return Response
```

### 4. SQL Injection Flow

```
User Input → Frontend → API (/api/profile/:userId)
                              ↓
                    String Concatenation (vulnerable)
                              ↓
                    Execute SQL Query (RDS)
                              ↓
                    Return Results + Educational Message
```

### 5. XSS Flow (Stored)

```
User Input → Frontend → API (/api/comments)
                              ↓
                    Store in Database (no sanitization)
                              ↓
                    Retrieve Comments
                              ↓
                    Render in HTML (no encoding)
                              ↓
                    Script Executes
```

### 6. Command Injection Flow

```
User Input → Frontend → API (/api/tools/ping)
                              ↓
                    Construct Shell Command (vulnerable)
                              ↓
                    Execute System Command
                              ↓
                    Return Output + Educational Message
```

## Security Architecture

### Intentional Vulnerabilities

1. **SQL Injection** (`/api/profile/:userId`)
   - String concatenation in SQL queries
   - No parameterized queries
   - Database errors exposed to client

2. **Command Injection** (`/api/tools/ping`)
   - User input passed directly to shell
   - No input sanitization
   - Command output returned to client

3. **XSS** (Multiple endpoints)
   - No input sanitization
   - No output encoding
   - Direct HTML rendering of user input

### Security Controls (Intentionally Minimal)

**What's Protected**:
- Network isolation (VPC, security groups)
- Database credentials (Secrets Manager)
- Authentication (Cognito JWT)
- HTTPS encryption (CloudFront)

**What's NOT Protected** (intentionally):
- Input validation
- Output encoding
- SQL parameterization
- Command sanitization
- Error message sanitization

## Deployment Architecture

### Infrastructure as Code

**AWS CDK** (TypeScript):
- `infrastructure/lib/vulnerable-demo-stack.ts`
- Defines all AWS resources
- Outputs: CloudFront URL, RDS endpoint, Cognito IDs

### Container Deployment

**Docker**:
- `backend/Dockerfile` - Multi-stage build
- Base image: `node:18-alpine`
- Build: Compile TypeScript
- Runtime: Node.js with compiled code

**ECR**:
- Repository: `vulnerable-demo-backend`
- Image tag: `latest`
- Pushed during deployment

**ECS**:
- Task definition updated with new image
- Service performs rolling update
- Health checks ensure availability

### Frontend Deployment

**S3 Upload**:
- HTML, CSS, JS files uploaded
- Content-Type headers set correctly
- Cache-Control headers configured

**CloudFront Invalidation**:
- Invalidate `/*` after upload
- Ensures users get latest version
- Takes 1-2 minutes to propagate

## Monitoring and Logging

### CloudWatch Logs

**ECS Task Logs**:
- Log group: `/ecs/vulnerable-demo-app`
- Streams: One per task
- Retention: 7 days (configurable)

**Application Logs**:
- Request logging (all API calls)
- Error logging (exceptions)
- Database query logging (for debugging)

### CloudWatch Metrics

**ECS Metrics**:
- CPU utilization
- Memory utilization
- Task count

**ALB Metrics**:
- Request count
- Response times
- HTTP status codes

**RDS Metrics**:
- Database connections
- CPU utilization
- Storage usage

### Health Checks

**ALB Health Check**:
- Endpoint: `/api/health`
- Interval: 30 seconds
- Timeout: 5 seconds
- Healthy threshold: 2
- Unhealthy threshold: 3

**Application Health Check**:
- Database connectivity
- Cognito configuration
- Overall system status

## Scalability

### Current Configuration

- **ECS**: 1 task (no auto-scaling)
- **RDS**: Single-AZ, db.t3.micro
- **ALB**: Single load balancer
- **CloudFront**: Global CDN

### Scaling Considerations

**For Production** (not this demo):
- ECS auto-scaling based on CPU/memory
- Multi-AZ RDS with read replicas
- Larger instance types
- WAF for additional protection
- CloudWatch alarms and notifications

**For This Demo**:
- Minimal resources to reduce cost
- Single-AZ deployment
- No auto-scaling
- Suitable for testing and education only

## Cost Breakdown

### Monthly Costs (Approximate)

| Service | Configuration | Cost |
|---------|--------------|------|
| RDS | db.t3.micro, 20GB | ~$15 |
| ECS Fargate | 0.25 vCPU, 512MB | ~$15 |
| ALB | Standard | ~$20 |
| NAT Gateway | 1 gateway | ~$35 |
| CloudFront | Low traffic | ~$1 |
| S3 | <1GB storage | ~$1 |
| Cognito | <50K MAU | Free |
| Secrets Manager | 1 secret | ~$0.40 |

**Total**: ~$85-90/month

**Cost Optimization**:
- Stop RDS when not in use: Save ~$15/month
- Set ECS desired count to 0: Save ~$15/month
- Delete NAT Gateway: Save ~$35/month (breaks outbound connectivity)

## Disaster Recovery

### Backup Strategy

**RDS**:
- Automated daily backups (7-day retention)
- Manual snapshots before major changes
- Point-in-time recovery available

**S3**:
- Versioning enabled
- Can restore previous versions
- Source code in Git repository

**Infrastructure**:
- CDK code in version control
- Can redeploy entire stack
- Configuration as code

### Recovery Procedures

**Complete Failure**:
1. Run `./deploy-all.sh`
2. Restore RDS from snapshot (if needed)
3. Validate deployment

**Partial Failure**:
- ECS task failure: Auto-restart
- RDS failure: AWS handles recovery
- ALB failure: AWS handles recovery

## Security Considerations

### For Educational Use

⚠️ **This application is intentionally vulnerable**

**Deployment Guidelines**:
- Use isolated AWS account
- Restrict network access (VPC, security groups)
- Monitor for unexpected activity
- Delete when not in use
- Never use in production

**Access Control**:
- Limit AWS account access
- Use IAM roles with least privilege
- Enable CloudTrail for audit logging
- Set up billing alerts

### Production Hardening (Not Implemented)

If this were a real application:
- Input validation and sanitization
- Parameterized SQL queries
- Output encoding for XSS prevention
- Command injection prevention
- WAF rules
- Rate limiting
- DDoS protection
- Security headers
- Content Security Policy
- Regular security scanning

## References

- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
