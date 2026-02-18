# AnyCompany CRM - Architecture Overview

## System Description

AnyCompany CRM is a full-stack web application built on AWS, providing customer relationship management capabilities including sales pipeline management, account tracking, opportunity management, and team performance monitoring. The application also includes an educational security vulnerability testing module.

## Technology Stack

- **Frontend**: React (TypeScript) with Cloudscape Design System, hosted on S3 + CloudFront
- **Backend**: Python Lambda functions behind API Gateway (REST)
- **Database**: Amazon RDS PostgreSQL 15 with RDS Proxy
- **Authentication**: Amazon Cognito (User Pool + Identity Pool)
- **Infrastructure**: AWS CDK (TypeScript)

## Architecture Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  CloudFront  │────▶│  S3 Bucket   │     │  Cognito User   │
│ Distribution │     │ (Static App) │     │  Pool + IdP     │
└──────┬───────┘     └──────────────┘     └────────┬────────┘
       │                                           │
       │              ┌────────────┐               │
       └─────────────▶│ API Gateway│◀──────────────┘
                      │  (REST)    │   (JWT Authorization)
                      └─────┬──────┘
                            │
                      ┌─────▼──────┐
                      │  WAF v2    │
                      │ (Regional) │
                      └─────┬──────┘
                            │
                      ┌─────▼──────┐     ┌──────────────┐
                      │  Lambda    │────▶│ Secrets Mgr  │
                      │  (Proxy)   │     └──────────────┘
                      └─────┬──────┘
                            │
                    ┌───────▼────────┐
                    │   RDS Proxy    │
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │  RDS Postgres  │
                    │   (Private)    │
                    └────────────────┘
```

## Network Architecture

- **VPC**: 10.0.0.0/16 CIDR block, 3 AZs
- **Public Subnets**: /24 - NAT Gateway
- **Private Isolated Subnets**: /28 - RDS, RDS Proxy
- **Private with Egress Subnets**: /24 - Lambda functions
- **VPC Endpoints**: S3 (Gateway), DynamoDB (Gateway)
- **VPC Flow Logs**: Enabled (REJECT traffic)

## Data Flow

1. User authenticates via Cognito hosted UI or direct sign-in
2. Frontend SPA served from S3 via CloudFront
3. API requests sent to API Gateway with JWT bearer token
4. API Gateway validates token via Cognito authorizer
5. WAF inspects request against managed rule sets
6. Lambda proxy function routes request to appropriate handler
7. Handler executes database operations via RDS Proxy
8. Response returned with CORS headers

## API Endpoints

| Resource | Methods | Description |
|----------|---------|-------------|
| /accounts | GET, POST, PUT, DELETE | Customer account management |
| /opportunities | GET, POST, PUT, DELETE | Sales opportunity tracking |
| /team-members | GET, POST, PUT, DELETE | Team member management |
| /industries | GET | Industry reference data (read-only) |
| /security-profile | GET, POST | User profile lookup (SQL injection demo) |
| /security-comments | GET, POST | Comment system (stored XSS demo) |
| /security-search | GET, POST | Search functionality (reflected XSS demo) |
| /security-tools/ping | POST | Network ping tool (command injection demo) |
