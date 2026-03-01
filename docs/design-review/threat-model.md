# AnyCompany CRM - Threat Model

## Scope

This threat model covers the AnyCompany CRM application including its frontend, backend API, database layer, authentication system, and CloudFront distribution with API proxy. It identifies potential threats, existing mitigations, and areas requiring attention.

## Assets

| Asset | Classification | Description |
|-------|---------------|-------------|
| Customer Account Data | Confidential | Company names, industries, contact info, revenue data |
| Sales Opportunities | Confidential | Deal amounts, stages, close dates, win probabilities |
| Team Member Data | Internal | Names, roles, email addresses, performance metrics |
| Database Credentials | Secret | RDS username/password stored in Secrets Manager |
| Cognito User Pool | Critical | User authentication and identity management |
| API Gateway | Critical | Entry point for all backend operations |
| CloudFront Distribution | Critical | Public entry point serving frontend and proxying API requests |
| Security Demo Endpoints | Low | Intentionally vulnerable, unauthenticated endpoints for pen-test education |

## Threat Analysis (STRIDE)

### Spoofing

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| Unauthorized API access (CRM endpoints) | Medium | Cognito JWT authorization on all CRM API endpoints | Mitigated |
| Unauthorized API access (security demo endpoints) | High | **Intentionally unauthenticated** — `AuthorizationType.NONE` for pen-test scanner access | Accepted (Demo) |
| Token theft/replay | Medium | 8-hour token expiry, HTTPS-only transport | Partially Mitigated |
| Identity pool abuse | Low | Unauthenticated identities denied via explicit DENY policy | Mitigated |
| Pen-test scanner impersonation | Low | CloudFront WAF allowlists `User-Agent: securityagent` — low-value target since security endpoints are already unauthenticated | Accepted (Demo) |

### Tampering

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| SQL Injection on CRM endpoints | Low | Parameterized queries in account/opportunity/team handlers | Mitigated |
| SQL Injection on security demo endpoints | High | **Intentionally vulnerable** — educational purpose, unauthenticated | Accepted (Demo) |
| Request body manipulation | Medium | API Gateway request validation enabled | Partially Mitigated |
| XSS payload injection (stored) | High | **Intentionally vulnerable** on security endpoints, unauthenticated | Accepted (Demo) |
| XSS payload injection (reflected) | High | **Intentionally vulnerable** on security endpoints, unauthenticated | Accepted (Demo) |
| DOM-based XSS via static HTML page | High | **Intentionally vulnerable** — `xss-advanced.html` served from S3 with innerHTML, href, and onerror injection vectors | Accepted (Demo) |
| DOM-based XSS via HTML API endpoints | High | **Intentionally vulnerable** — HTML responses for pen-test scanner detection (`/security-xss-page`, `/security-xss-comments`, `/security-xss-search`), unauthenticated | Accepted (Demo) |
| CloudFront API proxy path manipulation | Low | CloudFront Function only rewrites `/api/*` to `/prod/*`; no additional path traversal possible | Mitigated |

### Repudiation

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| Untracked API calls | Low | API Gateway access logging, CloudWatch metrics | Mitigated |
| Untracked pen-test scanner activity | Low | CloudFront access logs (with cookies) to S3, WAF metrics for SecurityAgent allowlist rule | Mitigated |
| Database changes without audit | Medium | No database audit logging configured | Gap |

### Information Disclosure

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| Database credential exposure | Low | Secrets Manager, no hardcoded credentials | Mitigated |
| Error message leakage | Medium | Error handler formats responses, but stack traces may leak in logs | Partially Mitigated |
| Demo credential exposure on login page | Low | Password masked with bullet characters, autofill styling overridden | Mitigated |
| S3 bucket data exposure | Low | CORS restrictions, authenticated access only | Mitigated |
| VPC traffic inspection | Low | VPC Flow Logs enabled for rejected traffic | Mitigated |
| Security demo data exposure via unauthenticated endpoints | Medium | Demo data only (synthetic `security_users` and `security_comments` tables); no real customer data accessible via unauthenticated endpoints | Accepted (Demo) |

### Denial of Service

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| API rate abuse | Medium | WAF IP rate limiting (3000 req/IP), bot control rules | Mitigated |
| CloudFront abuse | Medium | CloudFront WAF with IP Reputation List, Bot Control, and Common Rule Set (block mode) | Mitigated |
| Database connection exhaustion | Medium | RDS Proxy connection pooling (max 5 per Lambda) | Partially Mitigated |
| Lambda concurrency exhaustion | Low | No reserved concurrency configured | Gap |
| Unauthenticated endpoint abuse | Medium | Security demo endpoints have no auth — rate limiting via WAF is the only protection against automated abuse | Partially Mitigated |

### Elevation of Privilege

| Threat | Risk | Mitigation | Status |
|--------|------|------------|--------|
| Command injection via ping endpoint | High | **Intentionally vulnerable** — educational purpose, unauthenticated | Accepted (Demo) |
| Command injection via nslookup endpoint | High | **Intentionally vulnerable** — second vector for pen-test coverage, unauthenticated | Accepted (Demo) |
| Command injection via CSV export | High | **Intentionally vulnerable** — filename parameter passed to shell command | Accepted (Demo) |
| IDOR via security profile endpoint | Medium | **Intentionally vulnerable** — sequential IDs, no auth check, unauthenticated | Accepted (Demo) |
| Mass assignment via comments endpoint | Medium | **Intentionally vulnerable** — accepts author_name/role from body, unauthenticated | Accepted (Demo) |
| Cross-account access | Low | IAM policies scoped to specific resources | Mitigated |
| Lambda role over-privilege | Medium | CloudWatch PutMetricData uses wildcard resource | Gap |

## Data Flow Threats

### Frontend to CloudFront
- **Transport**: HTTPS enforced via CloudFront (TLS 1.2 minimum, 2021 policy)
- **WAF**: CloudFront WAF with Common Rule Set, IP Reputation List, Bot Control (block mode); Security Agent allowlisted at priority 0
- **Custom Domain**: secagentdemo.jossai.people.aws.dev with ACM certificate

### CloudFront to API Gateway (API Proxy)
- **Path Rewrite**: CloudFront Function rewrites `/api/*` to `/prod/*`
- **Caching**: Disabled for API proxy behavior
- **Headers**: All viewer headers forwarded (except Host)
- **Authentication**: None at CloudFront level; API Gateway enforces Cognito auth on CRM endpoints only

### API Gateway to Lambda
- **Integration**: Lambda proxy integration (full event forwarded)
- **Authorization**: Cognito authorizer validates JWT before Lambda invocation (CRM endpoints); security demo endpoints bypass authorization entirely

### Lambda to Database
- **Transport**: Within VPC, private subnets
- **Credentials**: Retrieved from Secrets Manager, cached in Lambda memory
- **Connection**: Via RDS Proxy (TLS not enforced)

## Recommendations

### High Priority
1. Enable TLS on RDS Proxy connections (`requireTLS: true`)
2. In production, switch all regional WAF rules from count to block mode
3. Remove or isolate security demo endpoints behind feature flag
4. Configure Lambda reserved concurrency to prevent exhaustion
5. Consider adding rate limiting specifically for unauthenticated security demo endpoints (separate from the global 3000 req/IP limit)

### Medium Priority
6. Enable database audit logging (PostgreSQL pgaudit extension)
7. Scope CloudWatch PutMetricData IAM policy to specific namespace
8. Enable Secrets Manager automatic rotation
9. Add API Gateway request throttling per-method

### Authorization Gaps
10. Enforce group-based access control at the Lambda handler layer using `cognito:groups` claims
11. Implement per-method authorization (restrict DELETE/PUT to Admin group)
12. Add API Gateway resource policies to limit invocation to known source IPs or VPC endpoints
13. Define custom OAuth scopes in Cognito to differentiate read vs. write access

### Privileged Access Gaps
14. Enable MFA for Cognito Admin group users
15. Enable Secrets Manager automatic rotation (30-day schedule)
16. Create dedicated IAM roles for operational tasks separate from deployment roles
17. Configure CloudTrail alerting for privileged API calls (`AdminCreateUser`, `DeleteDBInstance`, etc.)
18. Implement break-glass procedures with time-limited credentials for production DB access

### Log Protection Gaps
19. Encrypt all CloudWatch Log Groups with a KMS CMK
20. Enable CloudTrail with log file integrity validation
21. Enable PostgreSQL `pgaudit` extension for database audit logging
22. Centralize logs to a dedicated security account via cross-account subscriptions
23. Protect S3 logging bucket with versioning, MFA Delete, and deny-delete bucket policy
24. Set explicit retention policies on all log groups (minimum 1 year)

### Low Priority
25. Enable Multi-AZ for RDS in production
26. Enable RDS deletion protection in production
27. Consider adding VPC interface endpoints for Secrets Manager
