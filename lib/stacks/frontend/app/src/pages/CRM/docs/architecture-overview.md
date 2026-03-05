# AnyCompany CRM - Architecture Overview

## System Description

AnyCompany CRM is a full-stack web application built on AWS, providing customer relationship management capabilities including sales pipeline management, account tracking, opportunity management, and team performance monitoring. The application also includes an educational security vulnerability testing module with intentionally unauthenticated endpoints for AWS Security Agent pen-test scanning.

## Technology Stack

- **Frontend**: React (TypeScript) with Cloudscape Design System, hosted on S3 + CloudFront
- **Backend**: Python Lambda functions behind API Gateway (REST)
- **Database**: Amazon RDS PostgreSQL 15 with RDS Proxy
- **Authentication**: Amazon Cognito (User Pool + Identity Pool) with Essentials feature plan
- **Infrastructure**: AWS CDK (TypeScript)
- **Custom Domain**: app.secagent.ai.demo.aws (Route 53 + ACM)

## Architecture Diagram

A visual architecture diagram is available at `docs/SecurityAgentDiagram.png` and is displayed interactively on the Security Dashboard page (click to expand in a full-screen lightbox).

```
+---------------+     +----------------+     +-------------------+
|  CloudFront   |---->|   S3 Bucket    |     |   Cognito User    |
|  Distribution |     |  (Static App)  |     |   Pool + IdP      |
+-------+-------+     +----------------+     +---------+---------+
        |                                               |
        |  /api/* rewrite                               |
        |  +------------------+                         |
        +->| CloudFront Fn    |                         |
           | /api/* -> /prod/*|                         |
           +--------+---------+                         |
                    |                                   |
             +------v---------+                         |
             |   CloudFront   |                         |
             |  WAF (Global)  |                         |
             +------+---------+                         |
                    |                                   |
             +------v--------+                          |
             |  API Gateway  |<-------------------------+
             |    (REST)     |   (JWT Authorization -
             +------+--------+    CRM endpoints only)
                    |
             +------v--------+
             |    WAF v2     |
             |  (Regional)   |
             +------+--------+
                    |
             +------v--------+     +--------------+
             |    Lambda     |---->| Secrets Mgr  |
             |    (Proxy)    |     +--------------+
             +------+--------+
                    |
             +------v--------+
             |   RDS Proxy   |
             +------+--------+
                    |
             +------v--------+
             |  RDS Postgres |
             |   (Private)   |
             +---------------+
```

## Network Architecture

- **VPC**: 10.0.0.0/16 CIDR block, 3 AZs
- **Public Subnets**: /24 — NAT Gateway
- **Private Isolated Subnets**: /28 — RDS, RDS Proxy
- **Private with Egress Subnets**: /24 — Lambda functions
- **VPC Endpoints**: S3 (Gateway), DynamoDB (Gateway)
- **VPC Flow Logs**: Enabled (REJECT traffic)

## CloudFront Configuration

- **Custom Domain**: app.secagent.ai.demo.aws with ACM certificate (DNS-validated)
- **Route 53**: A-record alias pointing to CloudFront distribution
- **Default Behavior**: S3 origin (static React app) with HTTPS redirect
- **API Proxy Behavior**: `/api/*` routes rewritten to `/prod/*` via CloudFront Function, forwarded to API Gateway origin (caching disabled, all viewer headers forwarded)
- **Error Responses**: 403/404 → `/index.html` (SPA routing)
- **TLS**: Minimum TLS 1.2 (2021 policy), SNI
- **Logging**: CloudFront access logs to S3 with `distribution` prefix, cookies included

## Data Flow

1. User authenticates via Cognito hosted UI or direct sign-in
2. Frontend SPA served from S3 via CloudFront
3. Authenticated CRM API requests sent to API Gateway with JWT bearer token
4. API Gateway validates token via Cognito authorizer (CRM endpoints only)
5. Security demo endpoints are unauthenticated — no JWT required (pen-test scanner access)
6. Pen-test scanner traffic can also reach backend via CloudFront API proxy (`/api/*` → API Gateway)
7. WAF inspects request against managed rule sets (CloudFront WAF + Regional WAF)
8. Lambda proxy function routes request to appropriate handler
9. Handler executes database operations via RDS Proxy
10. Response returned with CORS headers

## API Endpoints

### Authenticated CRM Endpoints (Cognito JWT required)

| Resource | Methods | Description |
|----------|---------|-------------|
| /accounts | GET, POST, PUT, DELETE | Customer account management |
| /opportunities | GET, POST, PUT, DELETE | Sales opportunity tracking with full-text search |
| /team-members | GET, POST, PUT, DELETE | Team member management |
| /industries | GET | Industry reference data (read-only) |

### Unauthenticated Security Demo Endpoints (no JWT required)

| Resource | Methods | Description |
|----------|---------|-------------|
| /security-profile | GET, POST | User profile lookup (SQL injection demo) |
| /security-profile/{id} | GET | User profile by ID (SQL injection + IDOR demo) |
| /security-comments | GET, POST | Comment system (stored XSS + mass assignment demo) |
| /security-search | GET, POST | Search functionality (reflected XSS demo) |
| /security-tools/ping | POST | Network ping tool (command injection demo) |
| /security-tools/nslookup | POST | DNS lookup tool (command injection demo) |
| /security-xss-page | GET | DOM-based/reflected XSS (HTML response) |
| /security-xss-comments | GET | Stored XSS rendered as HTML page |
| /security-xss-search | GET | Reflected XSS rendered as HTML page |
| /security-health | GET | Security module health check |

### Static Security Demo Pages (served from S3 via CloudFront)

| Path | Description |
|------|-------------|
| /xss-advanced.html | Client-side DOM-based XSS demo (innerHTML, href injection, img onerror, URL parameter reflection) |
