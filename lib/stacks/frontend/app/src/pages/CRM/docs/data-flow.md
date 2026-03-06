# AnyCompany CRM - Data Flow Diagram

## Authentication Flow

```
+------------+    1. Login Request      +-----------------+
|  Browser   |------------------------->|  Cognito        |
|  (React)   |<------------------------|  Hosted UI      |
+-----+------+    2. JWT Tokens         +--------+--------+
      |
      |    3. API Request + Bearer Token
      v
+-------------+    5. Validate JWT    +-----------------+
| API Gateway |--------------------->|  Cognito        |
|             |<---------------------|  Authorizer     |
+------+------+    4. Allow/Deny      +-----------------+
       |
       |    7. Invoke Lambda
       v
+-------------+
|   Lambda    |
|   (Proxy)   |
+-------------+
```

## CRM Data Operations Flow

```
+----------+                    +--------------+
|  Browser |------- HTTPS ----->|  CloudFront  |
+----------+                    +------+-------+
                                       |
                         +-------------+-------------+
                         |                           |
                  +------v-------+          +--------v-------+
                  |  S3 (Static) |          |  WAF v2        |
                  |  React App   |          |  (CloudFront)  |
                  +--------------+          +----------------+

+----------+    API Call + JWT         +--------------+
|  React   |-------------------------->|  WAF v2      |
|  App     |                           |  (Regional)  |
+----------+                           +------+-------+
                                              |
                                       +------v-------+
                                       | API Gateway  |
                                       | + Cognito    |
                                       |   Authorizer |
                                       +------+-------+
                                              |
                                       +------v-------+
                                       |   Lambda     |
                                       |   Handler    |
                                       +--+---+---+---+
                                          |   |   |
                              +-----------+   |   +-----------+
                              v               v               v
                       +------------+  +------------+  +------------+
                       |  Secrets   |  | RDS Proxy  |  |  S3 Bucket |
                       |  Manager   |  |            |  |  (Images)  |
                       +------------+  +-----+------+  +------------+
                                             |
                                       +-----v------+
                                       |    RDS     |
                                       | PostgreSQL |
                                       +------------+
```

## CloudFront API Proxy Flow (Pen-Test Scanner Path)

```
+--------------+    /api/security-profile/1    +--------------+
|  Pen-Test    |------------------------------>|  CloudFront  |
|  Scanner     |  (User-Agent: securityagent)  |  Distribution|
+--------------+                               +------+-------+
                                                      |
                                               +------v-------+
                                               |  CloudFront  |
                                               |  WAF (Global)|
                                               |  Allow if UA |
                                               |  contains    |
                                               | "securityagent"|
                                               +------+-------+
                                                      |
                                               +------v-------+
                                               |  CloudFront  |
                                               |  Function    |
                                               | /api/* ->    |
                                               | /prod/*      |
                                               +------+-------+
                                                      |
                                               +------v-------+
                                               | API Gateway  |
                                               | (No JWT -    |
                                               |  security    |
                                               |  endpoints   |
                                               |  are unauth) |
                                               +------+-------+
                                                      |
                                               +------v-------+
                                               |  WAF v2      |
                                               |  (Regional)  |
                                               |  Count mode  |
                                               +------+-------+
                                                      |
                                               +------v-------+
                                               |   Lambda     |
                                               |  security_   |
                                               |  handler.py  |
                                               +--------------+
```

## Security Demo Endpoints Data Flow (Unauthenticated)

```
+----------+    POST /security-profile     +--------------+
|  Browser |------------------------------>|  API Gateway |
|  or Pen- |  Body: {"user_id":"1 OR 1=1"} | (NO Cognito  |
|  Test    |                               |  authorizer) |
|  Scanner |                               +------+-------+
+----------+                                      |
                                           +------v-------+
                                           |    WAF v2    |
                                           | All rules in |
                                           | COUNT mode   | <-- Intentionally permissive
                                           +------+-------+
                                                  |
                                           +------v-------+
                                           |   Lambda     |
                                           | security_    |
                                           | handler.py   |
                                           +------+-------+
                                                  |
                                   +--------------v--------------+
                                   |  "SELECT * FROM users       |
                                   |   WHERE id = '{user_id}'"   | <-- Unsanitized
                                   +--------------+--------------+
                                                  |
                                           +------v-------+
                                           |    RDS       |
                                           |  PostgreSQL  |
                                           +--------------+
```

## Credential Storage & Retrieval

```
+-----------------+    CDK Deploy    +------------------+
|  CDK Stack      |---------------->|  Secrets Manager |
|  (RDS Construct)|  Auto-generated  |  (DB Credentials)|
+-----------------+  credentials     +--------+---------+
                                              |
                                     GetSecretValue
                                              |
                                     +--------v---------+
                                     |  Lambda Function |
                                     |  (Cached in mem) |
                                     +--------+---------+
                                              |
                                     psycopg2 connection
                                              |
                                     +--------v---------+
                                     |    RDS Proxy     |
                                     |  (Conn Pooling)  |
                                     +--------+---------+
                                              |
                                     +--------v---------+
                                     |  RDS PostgreSQL  |
                                     +------------------+
```

## S3 Asset Flow

```
+--------------+    Presigned URL    +--------------+
|   Lambda     |------------------->|  S3 Bucket   |
|  (s3_integ)  |                    |  (Images)    |
+------+-------+                    +--------------+
       |                                    ^
       |  Enhanced JSON response            |
       |  with image URLs                   |
       v                                    |
+--------------+    Load images             |
|   Browser    |----------------------------+
|   (React)    |
+--------------+
```

## Static XSS Demo Page Flow

```
+--------------+    GET /xss-advanced.html   +--------------+
|  Browser /   |---------------------------->|  CloudFront  |
|  Pen-Test    |                             +------+-------+
|  Scanner     |                                    |
+------^-------+                             +------v-------+
       |                                     |  S3 Bucket   |
       |         HTML with inline JS         |  (Static)    |
       +-------------------------------------+--------------+
                 DOM-based XSS via:
                 - innerHTML injection
                 - href attribute injection
                 - img onerror injection
                 - URL parameter reflection
```
