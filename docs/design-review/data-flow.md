# AnyCompany CRM - Data Flow Diagram

## Authentication Flow

```
┌──────────┐    1. Login Request     ┌──────────────┐
│  Browser  │───────────────────────▶│   Cognito     │
│  (React)  │◀───────────────────────│   Hosted UI   │
└──────┬────┘    2. JWT Tokens       └──────┬────────┘
       │                                     │
       │         3. Midway SSO (Optional)    │
       │         ┌───────────────────────────┘
       │         ▼
       │    ┌──────────────┐
       │    │  OIDC IdP    │
       │    │  (Federate)  │
       │    └──────────────┘
       │
       │    4. API Request + Bearer Token
       ▼
┌──────────────┐    5. Validate JWT    ┌──────────────┐
│ API Gateway  │──────────────────────▶│   Cognito    │
│              │◀──────────────────────│   Authorizer │
└──────┬───────┘    6. Allow/Deny      └──────────────┘
       │
       │    7. Invoke Lambda
       ▼
┌──────────────┐
│   Lambda     │
│   (Proxy)    │
└──────────────┘
```

## CRM Data Operations Flow

```
┌──────────┐                    ┌──────────────┐
│  Browser  │───── HTTPS ──────▶│  CloudFront  │
└──────────┘                    └──────┬───────┘
                                       │
                    ┌──────────────────┐│┌──────────────┐
                    │  S3 (Static)     │◀┘│  WAF v2      │
                    │  React App       │  │  (CloudFront)│
                    └──────────────────┘  └──────────────┘
                                       
┌──────────┐    API Call + JWT         ┌──────────────┐
│  React   │──────────────────────────▶│  WAF v2      │
│  App     │                           │  (Regional)  │
└──────────┘                           └──────┬───────┘
                                              │
                                       ┌──────▼───────┐
                                       │ API Gateway  │
                                       │ + Cognito    │
                                       │   Authorizer │
                                       └──────┬───────┘
                                              │
                                       ┌──────▼───────┐
                                       │   Lambda     │
                                       │   Handler    │
                                       └──┬───┬───┬───┘
                                          │   │   │
                              ┌───────────┘   │   └───────────┐
                              ▼               ▼               ▼
                       ┌────────────┐  ┌────────────┐  ┌────────────┐
                       │  Secrets   │  │ RDS Proxy  │  │  S3 Bucket │
                       │  Manager   │  │            │  │  (Images)  │
                       └────────────┘  └─────┬──────┘  └────────────┘
                                             │
                                       ┌─────▼──────┐
                                       │    RDS     │
                                       │ PostgreSQL │
                                       └────────────┘
```

## CloudFront API Proxy Flow (Pen-Test Scanner Path)

```
┌──────────────┐    /api/security-profile/1    ┌──────────────┐
│  Pen-Test    │──────────────────────────────▶│  CloudFront  │
│  Scanner     │  (User-Agent: securityagent)  │  Distribution│
└──────────────┘                               └──────┬───────┘
                                                      │
                                               ┌──────▼───────┐
                                               │  CloudFront  │
                                               │  WAF (Global)│
                                               │  Priority 0: │
                                               │  Allow if UA │
                                               │  contains    │
                                               │ "securityagent"│
                                               └──────┬───────┘
                                                      │
                                               ┌──────▼───────┐
                                               │  CloudFront  │
                                               │  Function    │
                                               │ /api/* →     │
                                               │ /prod/*      │
                                               └──────┬───────┘
                                                      │
                                               ┌──────▼───────┐
                                               │ API Gateway  │
                                               │ (No JWT —    │
                                               │  security    │
                                               │  endpoints   │
                                               │  are unauth) │
                                               └──────┬───────┘
                                                      │
                                               ┌──────▼───────┐
                                               │  WAF v2      │
                                               │  (Regional)  │
                                               │  Count mode  │
                                               └──────┬───────┘
                                                      │
                                               ┌──────▼───────┐
                                               │   Lambda     │
                                               │  security_   │
                                               │  handler.py  │
                                               └──────────────┘
```

## Security Demo Endpoints Data Flow (Unauthenticated)

```
┌──────────┐    POST /security-profile     ┌──────────────┐
│  Browser  │─────────────────────────────▶│  API Gateway  │
│  or Pen-  │  Body: {"user_id": "1 OR 1=1"}│ (NO Cognito  │
│  Test     │                               │  authorizer) │
│  Scanner  │                               └──────┬───────┘
└──────────┘                                       │
                                            ┌──────▼───────┐
                                            │    WAF v2    │
                                            │ All managed  │
                                            │ rules in     │
                                            │ COUNT mode   │◀── Intentionally permissive
                                            └──────┬───────┘
                                                   │
                                            ┌──────▼───────┐
                                            │   Lambda     │
                                            │ security_    │
                                            │ handler.py   │
                                            └──────┬───────┘
                                                   │
                                    ┌──────────────▼──────────────┐
                                    │  f"SELECT * FROM users      │
                                    │   WHERE id = '{user_id}'"   │◀── Unsanitized
                                    └──────────────┬──────────────┘
                                                   │
                                            ┌──────▼───────┐
                                            │    RDS       │
                                            │  PostgreSQL  │
                                            └──────────────┘
```

## Credential Storage & Retrieval

```
┌─────────────────┐    CDK Deploy    ┌──────────────────┐
│  CDK Stack      │────────────────▶│  Secrets Manager  │
│  (RDS Construct)│  Auto-generated  │  (DB Credentials) │
└─────────────────┘  credentials     └────────┬─────────┘
                                              │
                                     GetSecretValue
                                              │
                                     ┌────────▼─────────┐
                                     │  Lambda Function  │
                                     │  (Cached in mem)  │
                                     └────────┬─────────┘
                                              │
                                     psycopg2 connection
                                              │
                                     ┌────────▼─────────┐
                                     │    RDS Proxy     │
                                     │  (Conn Pooling)  │
                                     └────────┬─────────┘
                                              │
                                     ┌────────▼─────────┐
                                     │  RDS PostgreSQL  │
                                     └──────────────────┘
```

## S3 Asset Flow

```
┌──────────────┐    Presigned URL    ┌──────────────┐
│   Lambda     │────────────────────▶│  S3 Bucket   │
│  (s3_integ)  │                     │  (Images)    │
└──────┬───────┘                     └──────────────┘
       │                                    ▲
       │ Enhanced JSON response             │
       │ with image URLs                    │
       ▼                                    │
┌──────────────┐    Load images      ┌──────┘
│   Browser    │─────────────────────┘
│   (React)    │
└──────────────┘
```

## Static XSS Demo Page Flow

```
┌──────────────┐    GET /xss-advanced.html   ┌──────────────┐
│  Browser /   │────────────────────────────▶│  CloudFront  │
│  Pen-Test    │                             └──────┬───────┘
│  Scanner     │                                    │
└──────────────┘                             ┌──────▼───────┐
       ▲                                     │  S3 Bucket   │
       │         HTML with inline JS         │  (Static)    │
       └─────────────────────────────────────└──────────────┘
                 DOM-based XSS via:
                 - innerHTML injection
                 - href attribute injection
                 - img onerror injection
                 - URL parameter reflection
```
