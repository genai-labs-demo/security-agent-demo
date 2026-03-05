# AnyCompany CRM - Security Controls

## Authentication & Authorization

### Amazon Cognito
- **User Pool**: Email-based sign-in with enforced password policy (8+ chars, upper/lower/digit/symbol)
- **Feature Plan**: Essentials (replaces deprecated AdvancedSecurityMode)
- **Identity Pool**: Federated identity with authenticated-only access (unauthenticated denied via explicit DENY policy)
- **Token Validity**: 8-hour access, ID, and refresh tokens
- **Account Recovery**: Email-only recovery
- **User Groups**: Admin and Users groups defined
- **Self Sign-Up**: Disabled (admin-created accounts only)

### Login Page Security
- Demo credentials have been removed from the login page — no credentials are displayed or embedded in the UI
- Password input field enforces `-webkit-text-security: disc` to prevent browser autofill from revealing the password in plain text
- Browser autofill styling overrides prevent credential leakage through CSS background color changes

### API Gateway Authorization
- Authenticated CRM endpoints (`/accounts`, `/opportunities`, `/team-members`, `/industries`) require `COGNITO` authorization type with `CognitoUserPoolsAuthorizer`
- Security demo endpoints (`/security-*`) are explicitly configured with `AuthorizationType.NONE` — no JWT required — to allow pen-test scanners to reach them without authentication
- Authorization header: `method.request.header.Authorization` (CRM endpoints only)

## Network Security

### VPC Configuration
- Database instances in private isolated subnets (no internet access)
- Lambda functions in private subnets with egress via NAT Gateway
- Security group allows only HTTPS (443) from VPC CIDR and PostgreSQL (5432) within the security group
- No public accessibility for database resources

### VPC Flow Logs
- Enabled for REJECT traffic to detect unauthorized access attempts

## Web Application Firewall (WAF v2)

### CloudFront WAF (Global scope)
- **AllowSecurityAgentPentest** (Priority 0): Allow action — matches requests where `User-Agent` header contains `securityagent` (case-insensitive). This ensures AWS Security Agent pen-test traffic bypasses all subsequent managed rules.
- **AWSManagedRulesCommonRuleSet** (Priority 1): Block mode (default action)
- **AWSManagedRulesAmazonIpReputationList** (Priority 2): Block mode (default action)
- **AWSManagedRulesBotControlRuleSet** (Priority 3): Block mode (default action)

### Regional WAF (API Gateway + Cognito)
- **IP Rate Limiting**: 3000 requests per IP (block action)
- **AWSManagedRulesCommonRuleSet**: Count mode (monitoring)
- **AWSManagedRulesBotControlRuleSet**: Count mode (monitoring)
- **AWSManagedRulesKnownBadInputsRuleSet**: Count mode (monitoring)
- **AWSManagedRulesUnixRuleSet**: Count mode (monitoring)
- **AWSManagedRulesSQLiRuleSet**: Count mode (monitoring)

> **Note**: All regional WAF managed rules are in count mode rather than block mode. This is intentional to allow the security demonstration endpoints to function for pen-test scanning. In a production environment, these should be set to block mode.

## CloudFront API Proxy

- CloudFront distribution includes an `/api/*` behavior that proxies requests to the API Gateway origin
- A CloudFront Function rewrites `/api/*` paths to `/prod/*` (the API Gateway stage prefix)
- Caching is disabled for API proxy requests; all viewer headers are forwarded (except `Host`)
- This allows the pen-test scanner to reach backend security demo endpoints through the same verified custom domain as the frontend (e.g., `https://app.secagent.ai.demo.aws/api/security-profile/1`)

## Data Protection

### Encryption
- **RDS**: Storage encryption enabled (AWS managed key)
- **RDS**: Performance Insights enabled
- **S3**: Server-side encryption on storage buckets
- **Secrets Manager**: Database credentials stored in Secrets Manager
- **CloudFront**: TLS 1.2 minimum (2021 policy), SNI

### Database Security
- **RDS Proxy**: Connection pooling and credential management
- **IAM Authentication**: Enabled on RDS instance
- **Backup Retention**: 7-day backup retention
- **Public Access**: Disabled

## Logging & Monitoring

### API Gateway
- Access logging to CloudWatch Log Group (3-month retention)
- Error-level method logging enabled
- Metrics enabled
- Data trace disabled (prevents logging sensitive request/response data)

### Lambda
- Standard CloudWatch logging
- Custom CloudWatch metrics for search latency (CRM/Database namespace)

## S3 Security
- Storage bucket configured with CORS restrictions (allowed origins only)
- Server access logging enabled via dedicated logging bucket
- EventBridge notifications enabled

## Authorization Best Practices

### Current Implementation
- Cognito User Pool with Admin and Users groups defined
- API Gateway `COGNITO` authorizer validates JWT on authenticated CRM endpoints
- Security demo endpoints are explicitly unauthenticated (`AuthorizationType.NONE`) for pen-test scanner access
- Identity Pool denies unauthenticated identities via explicit DENY policy
- Self sign-up disabled (admin-created accounts only)

### Recommendations

| Practice | Status | Detail |
|----------|--------|--------|
| Enforce least-privilege per API resource | Gap | All authenticated users can access all CRM endpoints regardless of group membership. API Gateway resource policies or Lambda-level authorization should enforce group-based access (e.g., Admin-only for DELETE operations). |
| Implement attribute-based access control (ABAC) | Gap | No Cognito custom attributes or claims are used to scope data access. Consider adding `department` or `team_id` claims to restrict users to their own accounts/opportunities. |
| Validate token scopes at the Lambda layer | Gap | Lambda handlers trust the Cognito authorizer but do not inspect `cognito:groups` or custom claims from the JWT. Add handler-level checks to enforce role-based logic. |
| Enforce API Gateway resource policies | Gap | No resource policy restricts which principals or source IPs can invoke the API. Add a resource policy to limit access to known VPC endpoints or IP ranges where applicable. |
| Implement per-method authorization | Gap | All methods on all resources share the same Cognito authorizer with no differentiation. Consider fine-grained authorizers or Lambda authorizers for sensitive operations (DELETE, PUT). |
| Token scope restriction | Partial | Cognito tokens use default scopes. Define and enforce custom OAuth scopes for read vs. write operations. |

## Privileged Access Best Practices

### Current Implementation
- CDK deployment uses caller's IAM credentials (typically Admin role)
- Database credentials auto-generated by CDK and stored in Secrets Manager
- Lambda execution role has permissions for Secrets Manager, RDS, S3, CloudWatch
- Cognito Admin group defined but not enforced at the API layer

### Recommendations

| Practice | Status | Detail |
|----------|--------|--------|
| Separate admin and operational IAM roles | Gap | No distinction between deployment-time and runtime IAM roles beyond the Lambda execution role. Create dedicated roles for operational tasks (DB maintenance, secret rotation) separate from deployment roles. |
| Enforce MFA for privileged operations | Gap | No MFA requirement for Cognito Admin group users or for AWS console access to production resources. Enable MFA for Cognito Admin users and require MFA for IAM roles performing privileged actions. |
| Implement break-glass procedures | Gap | No documented emergency access procedure. Define a break-glass process for production database access with time-limited credentials and audit logging. |
| Restrict Lambda execution role scope | Partial | Lambda role includes `PutMetricData` with wildcard resource. Scope all IAM actions to specific resource ARNs and namespaces. |
| Rotate privileged credentials | Gap | Secrets Manager automatic rotation not configured. Enable rotation with a 30-day schedule for database credentials. |
| Implement just-in-time access | Gap | No mechanism for temporary elevated access. Consider AWS SSO with time-limited permission sets for production access. |
| Audit privileged actions | Gap | No CloudTrail-based alerting for privileged API calls (e.g., `CreateUser`, `AdminSetUserPassword`, `DeleteDBInstance`). Configure CloudTrail event rules with SNS/EventBridge notifications. |
| Limit Cognito admin operations | Gap | No IP or condition restrictions on Cognito admin API calls. Add IAM policy conditions to restrict `AdminCreateUser`, `AdminDeleteUser` to specific source IPs or VPC endpoints. |

## Log Protection Best Practices

### Current Implementation
- API Gateway access logs sent to CloudWatch (3-month retention)
- VPC Flow Logs enabled for REJECT traffic
- S3 server access logging via dedicated logging bucket
- Lambda standard CloudWatch logging
- Data trace disabled on API Gateway (prevents sensitive data in logs)

### Recommendations

| Practice | Status | Detail |
|----------|--------|--------|
| Encrypt log groups with CMK | Gap | CloudWatch Log Groups use default encryption. Create a KMS CMK for log encryption and apply it to all log groups to prevent unauthorized log access. |
| Implement log immutability | Gap | No mechanism prevents log deletion or modification. Enable CloudWatch Logs resource policies to deny `DeleteLogGroup`, `DeleteLogStream`, and `PutRetentionPolicy` for non-admin principals. |
| Centralize logs to a dedicated security account | Gap | All logs reside in the application account. Export logs to a dedicated logging/security account via CloudWatch cross-account subscriptions or S3 replication for tamper resistance. |
| Enable CloudTrail with log file validation | Gap | No CloudTrail trail configured for management events. Enable CloudTrail with log file integrity validation and deliver to an S3 bucket with MFA Delete enabled. |
| Set appropriate log retention policies | Partial | API Gateway logs have 3-month retention, but Lambda and VPC Flow Logs use default (never expire). Set explicit retention policies on all log groups aligned with compliance requirements (minimum 1 year recommended). |
| Mask sensitive data in logs | Partial | Data trace is disabled on API Gateway, but Lambda handlers may log request bodies containing PII. Implement structured logging with a data masking utility to redact sensitive fields (email, phone, revenue data) before logging. |
| Monitor log pipeline health | Gap | No alerting if logging stops (e.g., CloudWatch delivery failures, S3 logging bucket full). Create CloudWatch alarms for log delivery metrics and S3 bucket size. |
| Enable database audit logging | Gap | PostgreSQL `pgaudit` extension not enabled. Enable `pgaudit` to capture DDL, DML, and role-based operations, and ship audit logs to CloudWatch. |
| Protect logging bucket from deletion | Gap | S3 logging bucket has no deletion protection. Enable versioning, MFA Delete, and a bucket policy denying `s3:DeleteBucket` and `s3:DeleteObject` for non-admin principals. |

## Authorization Best Practices (IAM Detail)

### Principle of Least Privilege (IAM)
- Lambda execution roles are scoped using CDK grant helpers (`grantRead`, `grantReadWrite`) rather than wildcard policies, ensuring each function only accesses the specific resources it needs
- S3 bucket access: `storageBucket.grantReadWrite()` granted only to the Cognito authenticated role; `grantRead()` to the proxy Lambda
- Database secret access: `databaseSecret.grantRead()` granted individually to the proxy Lambda and seed function
- One known exception: `cloudwatch:PutMetricData` uses `resources: ['*']` on the proxy Lambda role (CloudWatch does not support resource-level permissions for this action, but should be scoped to a condition key for the `CRM/Database` namespace)

### Cognito Group-Based Authorization
- Two user pool groups defined: `Admin` and `Users`, enabling role-based access control at the identity layer
- Self sign-up is disabled (`selfSignUpEnabled: false`), requiring administrator-created accounts only
- Identity Pool explicitly denies all actions for unauthenticated identities via an `Effect.DENY` policy on `["*"]` actions and resources

### API Gateway Authorization Enforcement
- Authenticated CRM endpoints default to `AuthorizationType.COGNITO` with a `CognitoUserPoolsAuthorizer`
- Security demo endpoints are explicitly set to `AuthorizationType.NONE` to allow unauthenticated pen-test scanner access
- JWT tokens are validated from the `Authorization` header before any Lambda invocation occurs (CRM endpoints only)
- Request validation is enabled via `RequestValidator` with both body and parameter validation
- CDK Nag suppressions (`AwsSolutions-APIG4`, `AwsSolutions-COG4`) are applied to security demo resources with documented justification

### Cross-Account Access Controls
- The DNS role stack creates a cross-account IAM role for NovaDomainService (account `791674550530`) with permissions scoped exclusively to Route 53 actions (`route53:CreateHostedZone`, `route53:ChangeResourceRecordSets`, etc.)
- No broad `sts:AssumeRole` permissions are granted to application roles

### CDK Nag Compliance
- `cdk-nag` suppressions are documented with explicit reasons for each deviation (e.g., `AwsSolutions-IAM4` for managed VPC policies, `AwsSolutions-IAM5` for Route 53 wildcard, `AwsSolutions-APIG4`/`AwsSolutions-COG4` for unauthenticated security demo endpoints)
- Suppressions serve as an audit trail for accepted risks

### Gaps & Recommendations
- Scope `cloudwatch:PutMetricData` using a `Condition` key for the `aws:RequestedRegion` or custom namespace
- Implement Cognito group-based authorization checks at the application layer (Lambda handler) to enforce Admin vs. Users permissions on write operations
- Consider adding resource-based policies on API Gateway for additional defense-in-depth

---

## Privileged Access Best Practices (Infrastructure Detail)

### Credential Management
- Database credentials are auto-generated via `Credentials.fromGeneratedSecret("postgres")` and stored in AWS Secrets Manager — no hardcoded credentials exist in the codebase
- Lambda functions retrieve credentials at runtime via `databaseSecret.grantRead()`, and the secret ARN is passed as an environment variable (`DATABASE_SECRET_ARN`)
- The seed function receives the database password via environment variable using `secretValueFromJson("password").unsafeUnwrap()` — this is a known CDK pattern for custom resources but means the password is visible in the Lambda configuration

### Database Access Controls
- RDS IAM Authentication is enabled (`iamAuthentication: true`), providing an alternative to password-based access
- RDS Proxy manages connection pooling and credential rotation between Lambda and the database
- Database is deployed in `PRIVATE_ISOLATED` subnets with no internet access and `publiclyAccessible: false`
- Security group restricts PostgreSQL (5432) access to within the security group only

### Administrative Access Separation
- Cognito `Admin` and `Users` groups provide identity-level separation of privileges
- Infrastructure deployment uses CDK with context-based stage selection (`dev`, etc.), separating deployment credentials from application credentials
- Cross-account roles (DNS) use `AccountPrincipal` with specific account IDs rather than broad trust policies

### Gaps & Recommendations
- Enable `requireTLS: true` on the RDS Proxy to encrypt database connections in transit (currently `requireTLS: false`)
- Enable Secrets Manager automatic rotation (`AwsSolutions-SMG4` is currently suppressed)
- Avoid passing database password via `unsafeUnwrap()` in the seed function environment — use the Secrets Manager SDK at runtime instead
- Consider implementing break-glass procedures with CloudTrail alerting for privileged operations
- Add MFA to the Cognito user pool for administrative users (currently suppressed via `AwsSolutions-COG2`)

---

## Log Protection Best Practices (Infrastructure Detail)

### Centralized Log Retention Enforcement
- A `LogGroupInjector` property injector is registered at the CDK App level (`bin/app.ts` → `getPropertyInjectors()`), automatically setting `RetentionDays.THREE_MONTHS` and `RemovalPolicy.DESTROY` on all CloudWatch Log Groups across the application
- A `FunctionLogGroupInjector` ensures every Lambda function gets a dedicated, managed Log Group (preventing orphaned log groups with indefinite retention)
- A `LogsRetentionAspect` CDK Aspect provides an additional enforcement mechanism for log retention at the CloudFormation level

### API Gateway Access Logs
- REST API access logs are written to a dedicated CloudWatch Log Group with explicit 3-month retention
- `dataTraceEnabled: false` prevents sensitive request/response payloads from being logged
- `loggingLevel: MethodLoggingLevel.ERROR` captures error-level execution logs

### S3 Access Logging
- Storage bucket has server access logging enabled via a dedicated `loggingBucket`
- CloudFront distribution logs are written to the frontend logging bucket with `logIncludesCookies: true` and a `distribution` prefix
- CloudFront log delivery is restricted via a resource policy requiring `aws:SourceAccount` condition, preventing cross-account log injection
- All logging buckets use `BlockPublicAccess.BLOCK_ALL` and `enforceSSL: true`

### Network-Level Logging
- VPC Flow Logs capture `REJECT` traffic for detecting unauthorized access attempts

### Encryption at Rest
- RDS storage encryption is enabled (`storageEncrypted: true`)
- S3 buckets enforce SSL (`enforceSSL: true`) and block all public access
- CloudFront enforces `TLS_V1_2_2021` minimum protocol version

### Gaps & Recommendations
- Log groups use `RemovalPolicy.DESTROY` — in production, consider `RETAIN` to preserve audit logs after stack deletion
- CloudWatch Log Groups do not have KMS encryption configured — consider adding a KMS key for log encryption at rest
- No CloudWatch Logs resource policy restricting who can delete or modify log groups — consider adding `logs:DeleteLogGroup` deny policies for non-admin roles
- VPC Flow Logs only capture `REJECT` traffic — consider capturing `ALL` traffic for comprehensive network audit
- No centralized log aggregation (e.g., to S3 or a SIEM) is configured for long-term retention beyond 3 months
- Consider enabling CloudTrail data events for S3 logging buckets to detect log tampering

---

## Known Security Considerations

### Intentional Vulnerabilities (Educational)
The `/security-*` API endpoints contain intentional vulnerabilities for educational demonstration purposes. These endpoints are **unauthenticated** (`AuthorizationType.NONE`) to allow pen-test scanners to discover and exploit them without requiring Cognito JWT tokens.

1. **SQL Injection** (`/security-profile`, `/security-profile/{id}`): User input directly concatenated into SQL queries
2. **IDOR** (`/security-profile/{id}`): Sequential numeric IDs accessible with no authorization check — any caller can enumerate all user records
3. **Stored XSS** (`/security-comments`): Comment content stored and returned without sanitization
4. **Reflected XSS** (`/security-search`): Search query reflected in response without encoding
5. **Command Injection #1** (`/security-tools/ping`): User input passed to `subprocess.run()` with `shell=True` without sanitization, including pipe/semicolon chaining
6. **Command Injection #2** (`/security-tools/nslookup`): Second distinct endpoint with `shell=True` for pen-test coverage
7. **Mass Assignment** (`/security-comments`): API accepts `author_name` and `role` fields from request body, allowing authorship spoofing
8. **Stored XSS (HTML)** (`/security-xss-comments`): Stored comments rendered as HTML page for pen-test scanner detection
9. **Reflected XSS (HTML)** (`/security-xss-search`): Search query reflected in HTML page for pen-test scanner detection
10. **DOM-based XSS (HTML)** (`/security-xss-page`): User input injected directly into HTML response with DOM-based XSS via URL fragment
11. **Advanced XSS (Static HTML)** (`/xss-advanced.html`): Client-side DOM-based XSS demo page served from S3 via CloudFront, featuring innerHTML injection, href attribute injection (`javascript:` protocol), img onerror event handler injection, and URL parameter/fragment reflection into the DOM
12. **Stored XSS (Opportunity Notes)**: The My Opportunities page includes an Opportunity Notes section where notes are rendered with `dangerouslySetInnerHTML`, allowing stored XSS via note content
13. **Command Injection (CSV Export)**: The CRM's Team Performance page includes an Export CSV feature whose filename parameter is vulnerable to injection

### Credential Display Security
- Login page no longer displays demo credentials — the demo credentials section has been fully removed from the login UI
- No credentials are embedded in the login page HTML or JavaScript
- Browser autofill styling is overridden via CSS (`:-webkit-autofill`) to prevent credential exposure through autofill background color changes
- Password input fields enforce `-webkit-text-security: disc` to ensure masking regardless of browser behavior

### Security Dashboard Architecture Diagram
- A visual architecture diagram (`SecurityAgentDiagram.png`) is displayed on the Security Dashboard page above the Core Capabilities section
- The diagram is interactive — clicking it opens a full-screen lightbox overlay for detailed viewing
- The lightbox includes a dark backdrop with blur, close button, and click-outside-to-dismiss behavior

### WAF Rule Overrides
- All regional WAF managed rules (CommonRuleSet, BotControl, KnownBadInputs, UnixRuleSet, SQLiRuleSet) are set to count mode to allow security demonstration endpoints to function for pen-test scanning
- CloudFront WAF includes a priority-0 allowlist rule for the AWS Security Agent `User-Agent` header, ensuring pen-test traffic bypasses CloudFront-level managed rules

### Database Configuration
- Deletion protection disabled (demo environment)
- Multi-AZ not enabled (demo environment, cost optimization)
- Default PostgreSQL port used
- Secret rotation not configured
- RDS Proxy TLS not required
