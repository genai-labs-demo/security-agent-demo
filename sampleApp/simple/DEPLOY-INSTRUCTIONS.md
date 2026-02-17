# Quick Deployment Instructions

## Before You Start

**IMPORTANT:** If you have a stuck CloudFormation stack from previous deployment attempts, delete it first:

```bash
aws cloudformation delete-stack --stack-name VulnerableDemoStack --region us-west-2
```

Wait for deletion to complete (check in AWS Console or run):
```bash
aws cloudformation wait stack-delete-complete --stack-name VulnerableDemoStack --region us-west-2
```

## Deploy the Simplified Version

1. Navigate to the simple directory:
```bash
cd simple
```

2. Run the deployment script:
```bash
./deploy.sh
```

mpted, type `yes` to confirm deployment

4. Wait 5-10 minutes for deployment to complete

## What Gets Deployed

- ✅ Lambda function (all API routes in one file)
- ✅ RDS PostgreSQL database
- ✅ Cognito User Pool with demo users
- ✅ S3 bucket for frontend
- ✅ CloudFront distribution

## After Deployment

You'll see output like:
```
✅ Deployment Complete!

Application URL: https://d1234567890.cloudfront.net

Credentials:
  Username: demouser
  Password: DemoPa23!
```

## Testing Vulnerabilities

### SQL Injection
Visit: `https://your-domain.cloudfront.net/profile.html`
- Try user ID: `1' OR '1'='1`

### XSS (Stored)
Visit: `https://your-domain.cloudfront.net/comments.html`
- Post comment: `<script>alert('XSS')</script>`

### Command Injection
Visit: `https://your-domain.cloudfront.net/tools.html`
- Try host: `127.0.0.1; ls -la`

## Troubleshooting

### Check Lambda Logs
```bash
aws logs tail /aws/lambda/SimpleVulnerableDemoStack-ApiFunction --follow
```

### Check Stack Status
```bash
aws cloudformation describe-stacks --stack-name SimpleVulnerableDemoStack --region us-west-2
```

### Redeploy
```bash
cd simple/infrastructure
npm run deploy
```

## Cleanup

When done testing:
```bash
cd simple/infrastructure
npm run destroy
```

Or:
```bash
aws cloudformation delete-stack --stack-name SimpleVulnerableDemoStack --region us-west-2
```

## Cost

Approximately $10-15/month while running:
- RDS db.t3.micro: ~$15/month
- Lambda: ~$1/month (1M requests free)
1/month
- S3: <$1/month
- Cognito: Free (up to 50K MAU)

**Remember to delete the stack when not in use to avoid charges!**
