# AnyCompany CRM - Threat Model

## Scope

This threat model covers the AnyCompany CRM application including its frontend, backend API, database layer, and authentication system. It identifies potential threats, existing mitigations, and areas requiring attention.

## Assets

| Asset | Classification | Description |
|-------|---------------|-------------|
| Customer Account Data | Confidential | Company names, industries, contact info, revenue data |
| Sales Opportunities | Confidential | Deal amounts, stages, close dates, win probabilities |
| Team Member Data | Internal | Names, roles, email addresses, performance metrics |
| Database Credentials | Secret | RDS username/password stored in Secrets Manager |
| Cognito User Pool | Critical | User authentication and identity management |
| API Gateway | Critical | Entry point for all backend operations |

## Threat Analysis (STRIDE)

### Spoofing

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| Unauthorized API access | Medium | Cognito JWT authorization on all API endpoints | Mitigated |
| Token theft/replay | Medium | 8-hour token expiry, HTTPS-only transport | Partially Mitigated |
| Identity pool abuse | Low | Unauthenticated identities denied via explicit DENY policy | Mitigated |

### Tampering

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| SQL Injection on CRM endpoints | Low | Parameterized queries in account/opportunity/team handlers | Mitigated |
| SQL Injection on security demo endpoints | High | **Intentionally vulnerable** - educational purpose | Accepted (Demo) |
| Request body manipulation | Medium | API Gateway request validation enabled | Partially Mitigated |
| XSS payload injection | High | **Intentionally vulnerable** on security endpoints | Accepted (Demo) |

### Repudiation

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| Untracked API calls | Low | API Gateway access logging, CloudWatch metrics | Mitigated |
| Database changes without audit | Medium | No database audit logging configured | Gap |

### Information Disclosure

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| Database credential exposure | Low | Secrets Manager, no hardcoded credentials | Mitigated |
| Error message leakage | Medium | Error handler formats responses, but stack traces may leak in logs | Partially Mitigated |
| S3 bucket data exposure | Low | CORS restrictions, authenticated access only | Mitigated |
| VPC traffic inspection | Low | VPC Flow Logs enabled for rejected traffic | Mitigated |

### Denial of Service

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| API rate abuse | Medium | WAF IP rate limiting (3000 req/IP), bot control rules | Mitigated |
| Database connection exhaustion | Medium | RDS Proxy connection pooling (max 5 per Lambda) | Partially Mitigated |
| Lambda concurrency exhaustion | Low | No reserved concurrency configured | Gap |

### Elevation of Privilege

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| Command injection via ping endpoint | High | **Intentionally vulnerable** - educational purpose | Accepted (Demo) |
| Cross-account access | Low | IAM policies scoped to specific resources | Mitigated |
| Lambda role over-privilege | Medium | CloudWatch PutMetricData uses wildcard resource | Gap |

## Data Flow Threats

### Frontend to API Gateway
- **Transport**: HTTPS enforced via CloudFront and API Gateway
- **Authentication**: JWT bearer token in Authorization header
- **CORS**: Restricted to configured callback URLs

### API Gateway to Lambda
- **Integration**: Lambda proxy integration (full event forwarded)
- **Authorization**: Cognito authorizer validates JWT before Lambda invocation

### Lambda to Database
- **Transport**: Within VPC, private subnets
- **Credentials**: Retrieved from Secrets Manager, cached in Lambda memory
- **Connection**: Via RDS Proxy (TLS not enforced)

## Recommendations

### High Priority
1. Enable TLS on RDS Proxy connections (`requireTLS: true`)
2. In production, switch all WAF rules from count to block mode
3. Remove or isolate security demo endpoints behind feature flag
4. Configure Lambda reserved concurrency to prevent exhaustion

### Medium Priority
5. Enable database audit logging (PostgreSQL pgaudit extension)
6. Scope CloudWatch PutMetricData IAM policy to specific namespace
7. Enable Secrets Manager automatic rotation
8. Add API Gateway request throttling per-method

### Authorization Gaps
9. Enforce group-based access control at the Lambda handler layer using `cognito:groups` claims
10. Implement per-method authorization (restrict DELETE/PUT to Admin group)
11. Add API Gateway resource policies to limit invocation to known source IPs or VPC endpoints
12. Define custom OAuth scopes in Cognito to differentiate read vs. write access

### Privileged Access Gaps
13. Enable MFA for Cognito Admin group users
14. Enable Secrets Manager automatic rotation (30-day schedule)
15. Create dedicated IAM roles for operational tasks separate from deployment roles
16. Configure CloudTrail alerting for privileged API calls (`AdminCreateUser`, `DeleteDBInstance`, etc.)
17. Implement break-glass procedures with time-limited credentials for production DB access

### Log Protection Gaps
18. Encrypt all CloudWatch Log Groups with a KMS CMK
19. Enable CloudTrail with log file integrity validation
20. Enable PostgreSQL `pgaudit` extension for database audit logging
21. Centralize logs to a dedicated security account via cross-account subscriptions
22. Protect S3 logging bucket with versioning, MFA Delete, and deny-delete bucket policy
23. Set explicit retention policies on all log groups (minimum 1 year)

### Low Priority
24. Enable Multi-AZ for RDS in production
25. Enable RDS deletion protection in production
26. Consider adding VPC interface endpoints for Secrets Manager
