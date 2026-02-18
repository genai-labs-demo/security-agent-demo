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

## Security Demo Endpoints Data Flow

```
┌──────────┐    POST /security-profile     ┌──────────────┐
│  Browser  │─────────────────────────────▶│  API Gateway  │
│           │  Body: {"user_id": "1 OR 1=1"}│              │
└──────────┘                               └──────┬───────┘
                                                   │
                                            ┌──────▼───────┐
                                            │    WAF v2    │
                                            │ SQLi_BODY:   │
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
