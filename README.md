# AnyCompany CRM — AWS Security Agent Demo Target

> A deliberately vulnerable CRM application for testing the [AWS Security Agent](https://aws.amazon.com/security/agent/) — an AI-powered penetration testing and vulnerability assessment service.

## What Is This?

This repo deploys a fictitious CRM app ("AnyCompany CRM") with intentional security vulnerabilities. The AWS Security Agent scans it, discovers the vulns, and demonstrates its remediation capabilities.

```
┌─────────────────────┐     scans      ┌──────────────────────────┐
│  AWS Security Agent │ ──────────────► │  AnyCompany CRM (target) │
│  (pen test service) │                 │  - IDOR endpoints        │
│                     │ ◄────────────── │  - SQL injection         │
│  Finds vulns,       │    findings     │  - XSS (stored/reflected)│
│  suggests fixes     │                 │  - Command injection     │
└─────────────────────┘                 └──────────────────────────┘
```

## Intentional Vulnerabilities

| Vulnerability | Endpoint | Description |
|---|---|---|
| IDOR | `/api/security-profile/{id}` | Sequential IDs, no authorization checks |
| SQL Injection | `/api/security-profile/{id}` | String concatenation in SQL queries |
| Stored XSS | `/api/security-comments` | Unsanitized user input stored and returned |
| Reflected XSS | `/api/security-xss-page?name=` | User input reflected in HTML |
| Command Injection | `/api/security-tools/ping` | `shell=True` with user-supplied input |

These endpoints are unauthenticated (`AuthorizationType.NONE`). All other CRM endpoints are protected by Cognito.

See [docs/pentest-guide.md](./docs/pentest-guide.md) for the full vulnerability inventory and scanner configuration.

## Getting Started

### Prerequisites

- Node.js 22+, Python 3.12+, Docker, AWS CDK CLI

### Configure

1. Update `cdk.json` → `context.accounts.dev` with your AWS account number and region
2. Update `CUSTOM_DOMAIN`, `HOSTED_ZONE_ID`, `HOSTED_ZONE_NAME` in `lib/stacks/frontend/index.ts`
3. After first deploy, update the API Gateway domain placeholder in `lib/stage.ts`

### Deploy

```bash
npm install
npx aws-cdk@2.1105.0 bootstrap aws://YOUR_ACCOUNT_ID/us-east-1
npx aws-cdk@2.1105.0 deploy "dev/*" --require-approval never
```

### Create a Demo User

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID> \
  --username <EMAIL> \
  --temporary-password <TEMP_PASSWORD> \
  --user-attributes Name=email,Value=<EMAIL> Name=email_verified,Value=true \
  --region us-east-1
```

### Run a Pen Test

1. Open the AWS Security Agent console
2. Create a penetration test with target URL `https://<your-domain>/api/`
3. Add the Cognito credentials from above
4. Run the scan — see [docs/pentest-guide.md](./docs/pentest-guide.md) for details
