# AWS Security Agent Demo Application

⚠️ **WARNING: This application contains intentional security vulnerabilities for educational purposes only. DO NOT deploy to production or expose to the public internet without proper security controls.**

## Overview

This is an educational web application designed to demonstrate AWS Security Agent's penetration testing capabilities. The application intentionally contains three critical security vulnerabilities:

1. **SQL Injection** - Database query manipulation
2. **Command Injection** - Operating system command execution
3. **Cross-Site Scripting (XSS)** - Multiple XSS variants (reflected, stored, DOM-based, attribute-based)

Each vulnerability includes educational messages that explain what went wrong and how AWS Security Agent detects these issues.

## Quick Start

Get started in minutes:

```bash
./deploy-all.sh
```

See [QUICKSTART.md](QUICKSTART.md) for detailed quick start instructions.

## Architecture

The application uses a simple three-tier architecture:

- **Frontend**: Static HTML/CSS/JavaScript served via CloudFront and S3
- **Backend**: Node.js/Express API with intentional vulnerabilities
- **Database**: PostgreSQL on AWS RDS
- **Authentication**: AWS Cognito User Pool

## Project Structure

```
.
├── infrastructure/     # AWS CDK infrastructure code
├── backend/           # Node.js/Express backend API
├── frontend/          # Static HTML/CSS/JS frontend
├── package.json       # Root workspace configuration
└── README.md          # This file
```

## Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)
- An AWS account with permissions to create:
  - CloudFront distributions
  - S3 buckets
  - RDS instances
  - Cognito User Pools
  - EC2/ECS resources
  - Application Load Balancers

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

This will install dependencies for all workspaces (infrastructure, backend, frontend).

## Development

### Infrastructure (CDK)

```bash
cd infrastructure
npm run build          # Compile TypeScript
npm run synth          # Synthesize CloudFormation template
npm run deploy         # Deploy to AWS
npm run destroy        # Tear down infrastructure
```

### Backend

```bash
cd backend
npm run build          # Compile TypeScript
npm run dev            # Run development server
npm test               # Run tests
```

### Frontend

The frontend uses vanilla HTML/CSS/JavaScript with no build step. Files are located in `frontend/` and will be deployed to S3 during infrastructure deployment.

## Testing

This project uses Jest for unit testing and fast-check for property-based testing.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests for specific workspace
cd backend && npm test
cd infrastructure && npm test
```

## Deployment

### Quick Deployment (Automated)

Deploy everything with a single command:

```bash
./deploy-all.sh
```

This script will:
1. Check prerequisites (AWS CLI, CDK, Docker, Node.js)
2. Deploy infrastructure with CDK
3. Configure Cognito users
4. Set up database schema and seed data
5. Build and deploy backend to ECS
6. Deploy frontend to S3 and CloudFront
7. Run validation tests

### Manual Deployment

For step-by-step deployment or troubleshooting, see [DEPLOYMENT.md](DEPLOYMENT.md).

#### Quick Steps:

1. **Deploy Infrastructure**:
   ```bash
   cd infrastructure && npm run deploy
   ```

2. **Set Up Database**:
   ```bash
   cd backend && npm run db:setup
   ```

3. **Deploy Backend**:
   ```bash
   cd backend && npm run deploy
   ```

4. **Deploy Frontend**:
   ```bash
   cd frontend && npm run deploy
   ```

5. **Validate Deployment**:
   ```bash
   npm run validate
   ```

### Deployment Scripts

- `npm run deploy:all` - Complete automated deployment
- `npm run deploy` - Deploy infrastructure only
- `npm run deploy:backend` - Deploy backend only
- `npm run deploy:frontend` - Deploy frontend only
- `npm run validate` - Run end-to-end validation tests

## Educational Use

This application is designed for:

- Learning about common web vulnerabilities
- Understanding how AWS Security Agent detects security issues
- Training security engineers and developers
- Demonstrating penetration testing capabilities

### Vulnerabilities Included

1. **SQL Injection** (`/api/profile/:userId`)
   - String concatenation in SQL queries
   - No parameterization
   - Authentication bypass possible

2. **Command Injection** (`/api/tools/ping`)
   - Unsanitized user input in system commands
   - Arbitrary command execution possible

3. **Cross-Site Scripting**
   - Reflected XSS (`/api/search`)
   - Stored XSS (`/api/comments`)
   - DOM-based XSS (client-side)
   - Attribute-based XSS (HTML attributes)

## Security Warnings

- ⚠️ This application is **intentionally vulnerable**
- ⚠️ Deploy only in **isolated test environments**
- ⚠️ Do **NOT** use in production
- ⚠️ Do **NOT** expose to public internet without controls
- ⚠️ Use only for **educational and testing purposes**

## Requirements

This application implements requirements specified in:
- `.kiro/specs/vulnerable-demo-app/requirements.md`
- `.kiro/specs/vulnerable-demo-app/design.md`

## License

MIT License - See LICENSE file for details

## Support

For issues or questions, please refer to the project documentation in `.kiro/specs/vulnerable-demo-app/`.
