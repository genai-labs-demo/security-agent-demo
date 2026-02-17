# Deployment Guide

This guide walks through deploying the AWS Security Agent Demo Application to AWS.

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- Docker installed and running
- Node.js 18+ and npm
- Sufficient AWS permissions to create:
  - CloudFormation stacks
  - VPC, subnets, security groups
  - RDS PostgreSQL instances
  - Cognito User Pools
  - S3 buckets
  - CloudFront distributions
  - Application Load Balancers
  - ECS clusters and services
  - ECR repositories

## Deployment Steps

### 1. Install Dependencies

```bash
npm install
```

This installs dependencies for all workspaces (infrastructure, backend, frontend).

### 2. Deploy Infrastructure

Deploy the AWS infrastructure using CDK:

```bash
cd infrastructure
npm run build
npm run deploy
```

This will:
- Create VPC with public and private subnets
- Provision RDS PostgreSQL database
- Create Cognito User Pool with sample users
- Create S3 bucket for frontend
- Set up Application Load Balancer
- Create ECS cluster and Fargate service
- Deploy CloudFront distribution

**Note:** The deployment will take approximately 10-15 minutes.

After deployment, CDK will output important values:
- `CloudFrontURL`: The application URL
- `FrontendBucketName`: S3 bucket for frontend assets
- `LoadBalancerDNS`: ALB DNS name
- `UserPoolId`: Cognito User Pool ID
- `UserPoolClientId`: Cognito Client ID
- `DatabaseEndpoint`: RDS endpoint

### 3. Configure Backend Environment

Update `backend/.env` with the values from CDK outputs:

```bash
# Copy the template
cp backend/.env.example backend/.env

# Edit with your values
nano backend/.env
```

Required environment variables:
```
DB_HOST=<DatabaseEndpoint from CDK output>
DB_PORT=5432
DB_NAME=vulnerabledemodb
DB_USER=dbadmin
DB_PASSWORD=<from Secrets Manager>
USER_POOL_ID=<UserPoolId from CDK output>
USER_POOL_CLIENT_ID=<UserPoolClientId from CDK output>
AWS_REGION=<your AWS region>
```

To get the database password from Secrets Manager:

```bash
aws secretsmanager get-secret-value \
  --secret-id vulnerable-demo-db-credentials \
  --query SecretString \
  --output text | jq -r .password
```

### 4. Set Up Database

Initialize the database schema and seed data:

```bash
cd backend
npm run db:setup
```

This will:
- Run database migrations (create tables)
- Seed vulnerability information
- Create sample users and comments

### 5. Set Up Cognito Users

The CDK creates two users, but you need to set their passwords:

```bash
# Set password for demouser
aws cognito-idp admin-set-user-password \
  --user-pool-id <UserPoolId> \
  --username demouser \
  --password "DemoPass123!" \
  --permanent

# Set password for admin
aws cognito-idp admin-set-user-password \
  --user-pool-id <UserPoolId> \
  --username admin \
  --password "AdminPass123!" \
  --permanent
```

### 6. Build and Deploy Backend

Build the backend and deploy to ECS:

```bash
cd backend
npm run build
npm run deploy
```

This will:
- Build Docker image
- Create ECR repository (if needed)
- Push image to ECR
- Update ECS task definition
- Deploy new version to ECS Fargate
- Wait for deployment to stabilize

**Note:** The first deployment may take 5-10 minutes.

### 7. Configure Frontend

Update `frontend/assets/config.js` with your CloudFront URL and Cognito details:

```javascript
const CONFIG = {
  API_BASE_URL: 'https://<CloudFrontDomain>',
  COGNITO: {
    USER_POOL_ID: '<UserPoolId>',
    CLIENT_ID: '<UserPoolClientId>',
    REGION: '<AWS Region>'
  }
};
```

### 8. Deploy Frontend

Upload frontend assets to S3 and invalidate CloudFront cache:

```bash
cd frontend
npm run deploy
```

This will:
- Upload HTML, CSS, and JavaScript files to S3
- Invalidate CloudFront cache
- Display the application URL

### 9. Verify Deployment

Access the application at the CloudFront URL from step 2.

Test the deployment:

1. **Login**: Use credentials `demouser` / `DemoPass123!`
2. **Check Infrastructure Status**: Dashboard should show all systems healthy
3. **Test Vulnerabilities**:
   - SQL Injection: `/pages/profile.html`
   - XSS: `/pages/comments.html` and `/pages/xss-advanced.html`
   - Command Injection: `/pages/tools.html`

## Quick Deployment Script

For convenience, you can deploy everything with:

```bash
# Deploy infrastructure
cd infrastructure && npm run deploy && cd ..

# Set up database
cd backend && npm run db:setup && cd ..

# Deploy backend
cd backend && npm run deploy && cd ..

# Deploy frontend
cd frontend && npm run deploy && cd ..
```

## Updating the Application

### Update Backend Code

```bash
cd backend
npm run build
npm run deploy
```

### Update Frontend Code

```bash
cd frontend
npm run deploy
```

### Update Infrastructure

```bash
cd infrastructure
npm run deploy
```

## Monitoring

### View Backend Logs

```bash
# Get log group name
aws logs describe-log-groups --log-group-name-prefix /ecs/vulnerable-demo

# Tail logs
aws logs tail /ecs/vulnerable-demo-app --follow
```

### Check ECS Service Status

```bash
aws ecs describe-services \
  --cluster vulnerable-demo-cluster \
  --services <service-name>
```

### Check Health Endpoint

```bash
curl https://<CloudFrontDomain>/api/health
```

## Troubleshooting

### Backend Not Starting

1. Check ECS task logs in CloudWatch
2. Verify environment variables are set correctly
3. Ensure database is accessible from ECS tasks
4. Check security group rules

### Database Connection Issues

1. Verify RDS instance is running
2. Check security group allows traffic from ECS tasks
3. Verify database credentials in Secrets Manager
4. Test connection from ECS task

### Frontend Not Loading

1. Check S3 bucket has files
2. Verify CloudFront distribution is deployed
3. Check browser console for errors
4. Verify config.js has correct API URL

### Authentication Issues

1. Verify Cognito User Pool is configured
2. Check user passwords are set
3. Verify frontend config.js has correct Cognito details
4. Check CORS configuration in backend

## Cleanup

To remove all resources and avoid charges:

```bash
# Delete frontend from S3
aws s3 rm s3://<FrontendBucketName> --recursive

# Delete ECR images
aws ecr batch-delete-image \
  --repository-name vulnerable-demo-backend \
  --image-ids imageTag=latest

# Destroy infrastructure
cd infrastructure
npm run destroy
```

**Note:** You may need to manually delete:
- CloudWatch log groups
- ECR repository
- Secrets Manager secrets (after recovery window)

## Security Warnings

⚠️ **This application is intentionally vulnerable**

- Deploy only in isolated test environments
- Do NOT expose to public internet without controls
- Do NOT use in production
- Use only for educational and testing purposes
- Consider using AWS Network Firewall or Security Groups to restrict access

## Cost Estimates

Approximate monthly costs (us-east-1 region):
- RDS db.t3.micro: ~$15
- ECS Fargate (1 task): ~$15
- ALB: ~$20
- CloudFront: ~$1 + data transfer
- S3: ~$1
- Cognito: Free tier (up to 50,000 MAUs)

**Total: ~$50-60/month**

To minimize costs:
- Stop RDS instance when not in use
- Set ECS desired count to 0 when not testing
- Use AWS Free Tier where applicable

## Support

For issues or questions, refer to:
- `.kiro/specs/vulnerable-demo-app/requirements.md`
- `.kiro/specs/vulnerable-demo-app/design.md`
- `backend/README.md`
