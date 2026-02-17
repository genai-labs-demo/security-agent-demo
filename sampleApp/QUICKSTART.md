# Quick Start Guide

Get the AWS Security Agent Demo Application running in minutes.

## Prerequisites

- AWS account with appropriate permissions
- AWS CLI configured (`aws configure`)
- AWS CDK installed (`npm install -g aws-cdk`)
- Docker installed and running
- Node.js 18+ installed

## One-Command Deployment

```bash
./deploy-all.sh
```

This automated script will:
1. ✅ Check all prerequisites
2. 🏗️ Deploy AWS infrastructure (VPC, RDS, Cognito, S3, CloudFront, ECS)
3. 👥 Configure Cognito users
4. 🗄️ Set up database schema and seed data
5. 🐳 Build and deploy backend Docker container
6. 🌐 Deploy frontend to S3 and CloudFront
7. ✅ Run validation tests

**Time**: ~20-25 minutes

## Access the Application

After deployment completes, you'll see:

```
🎉 Deployment Complete!

Application URL: https://xxxxx.cloudfront.net

Test Credentials:
  Username: demouser
  Password: DemoPass123!
```

## Test the Vulnerabilities

### 1. SQL Injection
- Navigate to "SQL Injection" demo
- Try payload: `1' OR '1'='1`
- See educational message

### 2. XSS (Cross-Site Scripting)
- Navigate to "XSS" demo
- Submit comment: `<script>alert('XSS')</script>`
- See script execute and educational message

### 3. Command Injection
- Navigate to "Command Injection" demo
- Try payload: `127.0.0.1; ls -la`
- See command output and educational message

## Cleanup

Remove all resources to avoid charges:

```bash
npm run cleanup
```

## Manual Deployment

If you prefer step-by-step deployment:

```bash
# 1. Deploy infrastructure
cd infrastructure && npm run deploy && cd ..

# 2. Set up database
cd backend && npm run db:setup && cd ..

# 3. Deploy backend
cd backend && npm run deploy && cd ..

# 4. Deploy frontend
cd frontend && npm run deploy && cd ..

# 5. Validate
npm run validate
```

## Troubleshooting

### Deployment Fails

**Check prerequisites**:
```bash
aws --version          # AWS CLI installed?
cdk --version          # CDK installed?
docker --version       # Docker installed?
node --version         # Node.js 18+?
aws sts get-caller-identity  # AWS credentials configured?
```

**Check Docker daemon**:
```bash
docker info
```

### Application Not Loading

**Check stack status**:
```bash
aws cloudformation describe-stacks --stack-name VulnerableDemoStack
```

**Check ECS tasks**:
```bash
aws ecs list-tasks --cluster vulnerable-demo-cluster
```

**Check logs**:
```bash
aws logs tail /ecs/vulnerable-demo-app --follow
```

### Health Check Fails

**Test directly**:
```bash
curl https://your-cloudfront-domain.cloudfront.net/api/health
```

**Check database**:
```bash
aws rds describe-db-instances --db-instance-identifier vulnerabledemostack-vulnerabledemodatabase*
```

## Next Steps

1. **Explore Vulnerabilities**: Try all three vulnerability types
2. **Read Educational Content**: Learn how each vulnerability works
3. **Test with AWS Security Agent**: Run security scans
4. **Review Code**: Examine intentional vulnerabilities in source code

## Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Detailed deployment guide
- [TESTING.md](TESTING.md) - Comprehensive testing guide
- [README.md](README.md) - Project overview
- [backend/README.md](backend/README.md) - Backend documentation

## Cost Estimate

Approximate monthly cost: **$50-60**

Breakdown:
- RDS db.t3.micro: ~$15
- ECS Fargate: ~$15
- ALB: ~$20
- CloudFront: ~$1
- S3: ~$1

**To minimize costs**:
- Run `npm run cleanup` when not in use
- Use AWS Free Tier where applicable

## Support

For issues:
1. Check [DEPLOYMENT.md](DEPLOYMENT.md) troubleshooting section
2. Review CloudWatch logs
3. Verify all prerequisites are met
4. Check AWS Console for resource status

## Security Warning

⚠️ **This application is intentionally vulnerable**

- Deploy only in isolated test environments
- Do NOT expose to public internet without controls
- Do NOT use in production
- Use only for educational purposes

## Quick Commands

```bash
# Deploy everything
./deploy-all.sh

# Deploy infrastructure only
cd infrastructure && npm run deploy

# Deploy backend only
cd backend && npm run deploy

# Deploy frontend only
cd frontend && npm run deploy

# Validate deployment
npm run validate

# Clean up everything
npm run cleanup

# View logs
aws logs tail /ecs/vulnerable-demo-app --follow

# Check health
curl https://your-domain.cloudfront.net/api/health | jq
```

## Test Credentials

**Demo User**:
- Username: `demouser`
- Password: `DemoPass123!`

**Admin User**:
- Username: `admin`
- Password: `AdminPass123!`

## What Gets Deployed

### Infrastructure
- VPC with public/private subnets
- RDS PostgreSQL database
- Cognito User Pool
- S3 bucket for frontend
- CloudFront distribution
- Application Load Balancer
- ECS Fargate cluster and service
- ECR repository

### Application
- Backend API with vulnerabilities
- Frontend web interface
- Database schema and seed data
- Sample users and comments

## Timeline

- Infrastructure deployment: ~10-15 minutes
- Backend deployment: ~5-10 minutes
- Frontend deployment: ~2-3 minutes
- Validation: ~1 minute

**Total**: ~20-30 minutes

---

Ready to start? Run:

```bash
./deploy-all.sh
```
