# AnyCompany CRM - AWS Agent Services Demo

> **A demo application for showcasing AWS Agent services**

## Overview

This is a demo application designed to highlight the functionality of AWS Agent services. It uses a fictitious CRM scenario (AnyCompany CRM) as a vehicle to demonstrate various AWS capabilities. This is not a real CRM system.

### Purpose

This application serves as a demonstration environment for:
- AWS Agent services and capabilities
- Serverless architecture patterns
- AWS service integrations
- Modern web application development on AWS

## Quick Links

- � **[Detailed Documentation](./README.demo.md)** - Complete CRM documentation
- 🎯 **[Setup Guide](./lib/stacks/frontend/app/DEMO-PREPARATION.md)** - Deployment checklist and guide
- 🖼️ **[Image Generation](./tools/README-crm-assets.md)** - Generate CRM assets with Bedrock

## Features

### Pipeline Dashboard
- Track sample opportunities across sales stages
- Basic metrics and filtering
- Search and sort functionality

### Account Management
- View sample customer accounts
- Industry categorization
- Basic account details

### Personal Pipeline
- Individual sales rep views
- Sample quota tracking
- Performance metrics

### Team Performance
- Team-wide analytics
- Individual rep performance
- Basic reporting


## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- Docker
- AWS CDK CLI
- AWS Account with appropriate permissions

### Post-Deployment: Create a Demo User

After deploying, you need to create a Cognito user to log in to the CRM app. Run the following command (replace the values with your deployed User Pool ID and desired credentials):

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username <EMAIL> \
  --temporary-password <TEMP_PASSWORD> \
  --user-attributes Name=email,Value=<EMAIL> Name=email_verified,Value=true \
  --region <YOUR_REGION>
```

On first login, you'll be prompted to set a permanent password. The User Pool ID can be found in the CDK deployment output or in the `.env` file (`VITE_USER_POOL_ID`).

The Security Agent portal (accessed via "Open Security Agent Portal") uses separate credentials — set those up in the Security Agent console.

### Post-Deployment: Create a Custom Domain (DNS)

The AWS Security Agent requires a target domain to run penetration tests against. After CDK deployment creates your CloudFront distribution, you need to set up a custom domain that points to it.

If using an Isengard account, create a `people.aws.dev` subdomain via [Supernova](https://supernova.amazon.dev/):

1. Deploy the CDK stacks first — this creates the `NovaDomainServiceRoute53Role` IAM role automatically (see `lib/stacks/dns/index.ts`)
2. Go to https://supernova.amazon.dev/ and fill out the form:
   - **Are you in AWS or CDO?** → Select `AWS`
   - **Select your organization** → Select `people`
   - **Enter your sub-domain** → Your alias (e.g., `jossai`)
   - **Owner Bindle ID** → Your team's Bindle resource ID (find it at [Bindle UI](https://bindles.amazon.com/))
   - **IAM Role ARN for SuperNova** → Use the role ARN from the CDK deployment output (`NovaDomainServiceRoute53Role`). The role grants Supernova's account (`791674550530`) permission to manage Route 53 hosted zones in your account. The trust policy and Route 53 permissions are created automatically by the `dns` stack.
3. After the domain is provisioned, update `cdk.json`:
   - Set `customDomain` to your new domain (e.g., `yourapp.youralias.people.aws.dev`)
   - Set `hostedZoneName` to the parent zone (e.g., `youralias.people.aws.dev`)
4. Redeploy to create the CloudFront alias record and SSL certificate
5. Use this domain as the **Target Domain** when configuring the Security Agent

### Quick Start

```bash
# 1. Clone and install
git clone [repository-url]
cd [repository-name]
npm install

# 2. Deploy to AWS using kit CLI
npm run kit
# Select your account, then choose "Deploy CDK Stack(s)"

# Or deploy all stacks directly
npm run kit -- deploy dev --all

# 3. Access the application
# Open CloudFormation console → Find frontend stack → Click CloudFront URL
```

### Local Development

```bash
# Start frontend dev server
npm run -w frontend dev

# Build frontend
npm run -w frontend build

# Run tests
npm run -w frontend test
```

Visit http://localhost:5173 to see the demo application locally.


## Architecture

Create professional images using Amazon Bedrock Nova Canvas:

```bash
# Generate all 99 images (~17 minutes, ~$4)
./tools/generate-crm-assets.sh

# Or generate specific categories
python3 tools/generate-sales-avatars.py      # 12 sales rep avatars
python3 tools/generate-company-logos.py      # 75 company logos
python3 tools/generate-industry-icons.py     # 5 industry icons
python3 tools/generate-empty-states.py       # 3 empty state illustrations
python3 tools/generate-app-logo.py           # 4 app logo sizes
```

See [tools/README-crm-assets.md](./tools/README-crm-assets.md) for details.


## Architecture

### Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite build tool
- AWS Cloudscape Design System
- React Router v6
- AWS Amplify for backend integration

**Backend:**
- Amazon S3 + CloudFront for hosting
- Amazon Cognito for authentication
- API Gateway + Lambda for REST API
- Amazon RDS PostgreSQL with RDS Proxy
- Amazon VPC with private subnets
- AWS WAF for security

### Project Structure

```
├── lib/stacks/
│   ├── frontend/              # Frontend hosting and React app
│   │   └── app/              # CRM application
│   │       ├── src/pages/CRM/    # CRM pages and components
│   │       └── README-CRM.md
│   └── backend/              # Backend services
│       ├── constructs/
│       │   └── auth.ts       # Cognito authentication
│       ├── rest-api/         # API Gateway REST API
│       ├── database.ts       # RDS PostgreSQL database
│       ├── networking.ts     # VPC configuration
│       └── storage/          # S3 storage
├── tools/                    # Image generation scripts
│   ├── generate-crm-assets.sh
│   └── README-crm-assets.md
└── docs/                     # Documentation
    └── kit/                  # Starter kit docs
```

## Fictitious Data

The application includes generated fictitious data for demo purposes:

- **50,000 Mock Opportunities**: Randomly generated for demonstration
- **75 Fictitious Accounts**: Sample company data
- **12 Demo Users**: Simulated sales reps and managers

**Note**: All data is completely fictitious and generated for demonstration purposes only.


## Future Enhancements

### Performance Targets
- ✅ Page load: < 2 seconds
- ✅ Filter response: < 500ms
- ✅ Search response: < 300ms (debounced)
- ✅ Table sorting: Instant

### Code Quality
- TypeScript strict mode
- ESLint for linting
- Memoized components and calculations
- Debounced search inputs
- Performance logging

### Accessibility
- WCAG 2.1 AA compliant
- Keyboard navigation
- Screen reader compatible
- Proper ARIA labels

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+


## Pricing Estimation

| AWS Service | Monthly Cost (Estimated) |
|-------------|-------------------------|
| Amazon S3 | $5 - $20 |
| Amazon CloudFront | $10 - $50 |
| AWS WAF | $10 - $30 |
| Amazon Cognito | $0 - $10 (first 50K MAU free) |
| Amazon API Gateway | $5 - $20 |
| Amazon RDS PostgreSQL | $50 - $150 |
| **Total** | **$120 - $380/month** |

*Use [AWS Pricing Calculator](https://calculator.aws/) for detailed estimates.*

## Documentation

### Main Documentation
- **[Detailed README](./README.demo.md)** - Complete CRM documentation
- **[CRM Application](./lib/stacks/frontend/app/README-CRM.md)** - Frontend app docs
- **[Image Generation](./tools/README-crm-assets.md)** - Asset generation guide

### Starter Kit Documentation
- **[Machine Setup](./docs/kit/machine-setup.md)** - Developer machine setup
- **[Demo Creation](./docs/kit/demo-creation.md)** - Creating new demos
- **[Demo Setup](./docs/kit/demo-setup.md)** - Setting up existing demos
- **[Design Documentation](./docs/kit/design.md)** - Starter kit architecture

## Troubleshooting

### Build Errors
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Deployment Issues
```bash
# Check AWS credentials
aws sts get-caller-identity

# Bootstrap CDK (first time only)
npm run kit -- bootstrap dev

# Deploy with kit CLI
npm run kit -- deploy dev --all
```

### Frontend Issues
```bash
# Clear Vite cache
rm -rf lib/stacks/frontend/app/node_modules/.vite

# Rebuild
npm run -w frontend build
```


## Clean-up

To remove all AWS resources:

```bash
# Delete all stacks using kit CLI
npm run kit
# Select your account, then choose "Destroy CDK Stack(s)"

# Or use CDK directly
npm run cdk destroy "*/**"
```

**Note**: S3 buckets may need to be emptied before deletion.

## Support

For questions about this demo application:
1. Review the documentation in this repository
2. Contact your AWS support team

## Note

This is a demo application for showcasing AWS Agent services. It is not intended for production use or as a real CRM system.
- Replace mock data with real API calls
- Add comprehensive authentication
- Implement data persistence
- Add error handling and logging
- Implement rate limiting
- Add monitoring and alerting

## License

[Apache License Version 2.0](/LICENSE)
