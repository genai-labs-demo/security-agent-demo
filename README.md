# AWS Security Agent Demo

> A purpose-built demo environment for showcasing the **AWS Security Agent** — an AI-powered service that performs automated penetration testing and vulnerability assessment on web applications.

## What Is This?

This project deploys a realistic but intentionally vulnerable web application (a fictitious CRM called "AnyCompany CRM") so that the AWS Security Agent can scan it, discover vulnerabilities, and demonstrate its remediation capabilities.

The CRM app is not the point — it's the target. The Security Agent is the star.

## How It Works

```
┌─────────────────────┐     scans      ┌──────────────────────────┐
│  AWS Security Agent │ ──────────────► │  AnyCompany CRM (target) │
│  (pen test service) │                 │  - IDOR endpoints        │
│                     │ ◄────────────── │  - SQL injection         │
│  Finds vulns,       │    findings     │  - XSS (stored/reflected)│
│  suggests fixes     │                 │  - Command injection     │
└─────────────────────┘                 └──────────────────────────┘
```

1. **Deploy** the CRM application to your AWS account
2. **Configure** the AWS Security Agent with the target domain and credentials
3. **Run** a penetration test — the agent crawls the app, discovers endpoints, and tests for vulnerabilities
4. **Review** findings — the agent reports discovered vulnerabilities with severity, evidence, and remediation guidance

## Intentional Vulnerabilities

The application includes deliberately vulnerable endpoints for the Security Agent to discover:

| Vulnerability | Endpoint | Description |
|---|---|---|
| IDOR | `/api/security-profile/{id}` | Direct object references without authorization checks |
| SQL Injection | `/api/security-search` | Unsanitized user input in database queries |
| Stored XSS | `/api/security-comments` | User input rendered without escaping |
| Command Injection | `/api/security-tools/ping` | OS command execution with user-supplied input |

These endpoints are intentionally unauthenticated (`AuthorizationType.NONE`) so the Security Agent's pen test scanner can reach them without a JWT token.

All other CRM endpoints (`/accounts`, `/opportunities`, `/team-members`, etc.) are protected by Cognito authorization and represent the "secure" portion of the application.

## Architecture

**Frontend:** React 18 + TypeScript, Cloudscape Design System, hosted on S3 + CloudFront with WAF
**Backend:** API Gateway + Lambda (Python), RDS PostgreSQL with RDS Proxy, VPC with private subnets
**Auth:** Amazon Cognito (User Pool + Identity Pool), WAF with managed rule groups
**Security:** CDK Nag (AWS Solutions checks), VPC flow logs, encrypted storage, secret rotation


```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  CloudFront  │────▶│  S3 Bucket   │     │  Cognito User   │
│ Distribution │     │ (Static App) │     │  Pool + IdP     │
└──────┬───────┘     └──────────────┘     └────────┬────────┘
       │                                           │
       │  /api/* rewrite                           │
       ▼                                           │
┌──────────────┐                                   │
│ CloudFront   │                                   │
│ WAF (Global) │                                   │
└──────┬───────┘                                   │
       │                                           │
┌──────▼──────┐                                    │
│ API Gateway │◀───────────────────────────────────┘
│  (REST)     │   JWT auth (CRM endpoints only)
└─────┬───────┘   No auth (security-* endpoints)
      │
┌─────▼──────┐     ┌──────────────┐
│  Lambda    │────▶│ Secrets Mgr  │
│  (Proxy)   │     └──────────────┘
└─────┬──────┘
      │
┌─────▼──────────┐
│   RDS Proxy    │
└─────┬──────────┘
      │
┌─────▼──────────┐
│  RDS Postgres  │
│   (Private)    │
└────────────────┘
```

**Stack:** React + TypeScript (Cloudscape) / Python Lambda / RDS PostgreSQL 15 / CDK (TypeScript)

## Security Controls

Despite the intentional vulnerabilities on demo endpoints, the infrastructure follows AWS security best practices:

- VPC with private subnets, NAT gateway, and VPC endpoints
- WAF v2 on both CloudFront (global) and API Gateway (regional)
- Cognito authentication on all CRM endpoints
- RDS encryption at rest, non-default port, secret rotation
- S3 bucket encryption, SSL enforcement, access logging
- CloudFront TLS 1.2, OAC for S3 origin
- CDK Nag (AwsSolutions) with zero non-compliant findings

See **[Security Controls](./docs/design-review/security-controls.md)** and **[CDK Nag Report](./docs/design-review/cdk-nag-report.pdf)** for details.

## Getting Started

### Prerequisites

- Node.js 22+
- Python 3.12+
- Docker
- AWS CDK CLI
- AWS account with appropriate permissions

### Deploy

```bash
# Install dependencies
npm install

# Deploy using the kit CLI
npm run kit
# Select your account → "Deploy CDK Stack(s)"

# Or deploy directly
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

The User Pool ID is in the CDK output or the frontend `.env` file (`VITE_USER_POOL_ID`).

### Configure the Security Agent

1. Open the AWS Security Agent console
2. Create a new penetration test
3. Set target URL: `https://app.secagent.ai.demo.aws/api/`
4. Add credentials (email/password from the Cognito user above)
5. Add accessible URLs (Cognito, API Gateway, CDNs) — see **[Pen Test Guide](./docs/pentest-guide.md)**
6. Run the scan

The agent will discover the intentional vulnerabilities and generate findings with remediation guidance.

### Resource Integration

After cloning, configure for your environment:

1. **AWS Account** — Update `cdk.json` → `context.accounts.dev` with your account number and region
2. **Custom Domain** — Update `CUSTOM_DOMAIN`, `HOSTED_ZONE_ID`, `HOSTED_ZONE_NAME` in `lib/stacks/frontend/index.ts`
3. **API Gateway Domain** — After first deploy, update the hardcoded domain in `lib/stage.ts` (`frontend.addApiProxy(...)`)
4. **GitHub Repo** — The Security Agent needs a repo to scan; push this code to your own repo

## Project Structure

```
├── lib/stacks/
│   ├── frontend/           # CloudFront + S3 hosting, React app
│   │   └── app/            # CRM application (scan target)
│   ├── backend/
│   │   ├── rest-api/       # API Gateway + Lambda proxy
│   │   │   └── proxy/
│   │   │       └── handlers/
│   │   │           └── security_handler.py  ← intentional vulns
│   │   ├── database.ts     # RDS PostgreSQL + secret rotation
│   │   ├── networking.ts   # VPC, subnets, endpoints
│   │   └── constructs/
│   │       └── auth.ts     # Cognito + WAF
│   └── dns/                # Route 53 IAM role
├── docs/
│   ├── pentest-guide.md    # Scanner configuration guide
│   └── design-review/      # Architecture, security controls, CDK nag
└── tools/                  # CLI, asset generation, nag report
```

## Documentation

| Document | Description |
|---|---|
| [Pen Test Guide](./docs/pentest-guide.md) | Vulnerability endpoints and scanner configuration |
| [Security Controls](./docs/design-review/security-controls.md) | Infrastructure security measures |
| [CDK Nag Report](./docs/design-review/cdk-nag-report.pdf) | AwsSolutions compliance report |
| [Architecture Overview](./docs/design-review/architecture-overview.md) | System architecture and data flow |
| [Threat Model](./docs/design-review/threat-model.md) | Threat analysis |
| [CRM App Details](./README.demo.md) | CRM application documentation |
| [Setup Guide](./lib/stacks/frontend/app/DEMO-PREPARATION.md) | Deployment checklist |

## Clean Up

```bash
npm run kit
# Select your account → "Destroy CDK Stack(s)"

# Or directly
npx aws-cdk@2.1105.0 destroy "dev/*"
```

## License

[Apache License Version 2.0](/LICENSE)

### Infrastructure

```
├── lib/stacks/
│   ├── frontend/           # S3 + CloudFront + WAF + Route 53
│   │   └── app/            # React CRM application
│   ├── backend/            # API Gateway + Lambda + RDS + VPC
│   │   ├── rest-api/       # REST API with vuln endpoints
│   │   ├── database.ts     # RDS PostgreSQL + secret rotation
│   │   └── networking.ts   # VPC, subnets, security groups
│   └── dns/                # IAM role for domain management
├── tools/                  # CLI tooling, asset generation
└── docs/                   # Design review, pen test guide
```

## Getting Started

### Prerequisites

- Node.js 22+
- Python 3.12+
- Docker (for Lambda bundling)
- AWS CDK CLI
- AWS account with appropriate permissions

### Deploy

```bash
# Install dependencies
npm install

# Deploy using the interactive CLI
npm run kit
# Select your account → "Deploy CDK Stack(s)"

# Or deploy directly
npx aws-cdk@2.1105.0 deploy "dev/*" --require-approval never
```

### Create a Demo User

After deployment, create a Cognito user for the CRM login:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID> \
  --username <EMAIL> \
  --temporary-password <TEMP_PASSWORD> \
  --user-attributes Name=email,Value=<EMAIL> Name=email_verified,Value=true \
  --region us-east-1
```

The User Pool ID is in the CDK deployment output or the frontend `.env` file (`VITE_USER_POOL_ID`).

### Configure the Security Agent

1. Open the AWS Security Agent console
2. Create a new penetration test with:
   - **Target URL:** `https://<your-domain>/api/` (unauthenticated vuln endpoints)
   - **Target URL:** `https://<your-domain>/` (SPA frontend for login flow)
   - **Credentials:** The Cognito user you created above
3. Run the scan and review findings

See [docs/pentest-guide.md](./docs/pentest-guide.md) for detailed configuration including accessible URLs and credential setup.

## Resource Setup

Before deploying, configure these for your environment:

1. **AWS Account** — Update `cdk.json` → `context.accounts.dev` with your account number and region
2. **Custom Domain** — Update `CUSTOM_DOMAIN`, `HOSTED_ZONE_ID`, `HOSTED_ZONE_NAME` in `lib/stacks/frontend/index.ts`
3. **API Gateway Domain** — After first deploy, update the hardcoded domain in `lib/stage.ts` (`frontend.addApiProxy(...)`)
4. **GitHub Repo** — The Security Agent needs a repo to scan for code-level findings

## Security Posture

Despite the intentional vulnerabilities, the infrastructure follows AWS security best practices:

- **CDK Nag** — AWS Solutions checks enabled with zero non-compliant findings (see [cdk-nag-report.pdf](./docs/design-review/cdk-nag-report.pdf))
- **WAF** — CloudFront and API Gateway protected with AWS managed rule groups (Common, Bot Control, Known Bad Inputs, SQLi, Unix)
- **VPC** — Database in private isolated subnets, Lambda in private subnets with NAT egress, flow logs enabled
- **Encryption** — RDS storage encrypted, Secrets Manager with automatic 30-day rotation, S3 bucket encryption
- **Auth** — Cognito with enforced password policy, identity pool denies unauthenticated access
- **Least Privilege** — IAM policies scoped to specific resources, no `*` resource policies outside CDK framework defaults

The vulnerable endpoints are isolated to the `/security-*` path and are clearly documented as intentional for pen testing.

## Design Review Documentation

- [Architecture Overview](./docs/design-review/architecture-overview.md)
- [Security Controls](./docs/design-review/security-controls.md)
- [Data Flow](./docs/design-review/data-flow.md)
- [Threat Model](./docs/design-review/threat-model.md)
- [CDK Nag Report](./docs/design-review/cdk-nag-report.pdf)
- [Pen Test Guide](./docs/pentest-guide.md)

## Estimated Cost

| Service | Monthly Estimate |
|---|---|
| RDS PostgreSQL | $50 – $150 |
| CloudFront + S3 | $15 – $70 |
| WAF | $10 – $30 |
| API Gateway + Lambda | $5 – $20 |
| VPC (NAT Gateway) | $30 – $45 |
| Cognito | $0 – $10 |
| **Total** | **~$110 – $325/month** |

## Clean Up

```bash
npm run kit
# Select your account → "Destroy CDK Stack(s)"

# Or directly
npx aws-cdk@2.1105.0 destroy "dev/*"
```

## License

[Apache License Version 2.0](./LICENSE)
