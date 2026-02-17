# Simplified AWS Security Agent Demo

**Ultra-simple version with 90% less code and complexity.**

## What's Different?

### Before (Complex)
- ECS/Fargate containers
- Application Load Balancer
- Docker builds
- Health checks
- Multiple backend files
- ~800 lines of backend code
- ~350 lines of CDK code
- 20+ minute deployment
- $85/month cost

### After (Simple)
- **Single Lambda function**
- **Lambda Function URLs** (no ALB)
- **No Docker**
- **No health checks**
- **One backend file** (`lambda/index.ts`)
- **~250 lines of backend code**
- **~150 lines of CDK code**
- **5-10 minute deployment**
- **$10-15/month cost**

## Architecture

```
CloudFront → Lambda Function URL → RDS + Cognito
```

That's it! Just 5 AWS resources:
1. Lambda function (all API routes)
2. RDS PostgreSQL
3. Cognito User Pool
4. S3 bucket (frontend)
5. CloudFront distribution

## File Structure

```
simple/
├── lambda/
│   ├── index.ts          # Single file - all API routes (~250 lines)
│   ├── package.json
│   └── tsconfig.json
├── infrastructure/
│   ├── lib/
│   │   └── simple-stack.ts  # CDK stack (~150 lines)
│   ├── bin/
│   │   └── app.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── cdk.json
├── deploy.sh             # Single deployment script
└── README.md             # This file
```

**Total: 8 files** (vs 40+ in complex version)

## Deployment

### Prerequisites
- AWS CLI configured
- AWS CDK installed (`npm install -g aws-cdk`)
- Node.js 18+

### One Command
```bash
cd simple
./deploy.sh
```

That's it! Takes 5-10 minutes.

### What It Does
1. ✅ Installs dependencies
2. ✅ Deploys infrastructure (Lambda, RDS, Cognito, S3, CloudFront)
3. ✅ Sets up Cognito users
4. ✅ Initializes database
5. ✅ Deploys frontend
6. ✅ Outputs application URL

## Features

All vulnerabilities work exactly the same:
- ✅ SQL Injection (`/api/profile/:userId`)
- ✅ XSS - Stored (`/api/comments`)
- ✅ Command Injection (`/api/tools/ping`)
- ✅ Educational messages
- ✅ Same frontend

## Cost

**~$10-15/month:**
- Lambda: ~$1 (1M requests free tier)
- RDS db.t3.micro: ~$15
- CloudFront: ~$1
- S3: <$1
- Cognito: Free (up to 50K MAU)

**vs $85/month for ECS version**

## Benefits

✅ **90% less code** - Easier to understand  
✅ **No Docker** - No container complexity  
✅ **No health checks** - No deployment issues  
✅ **Faster deploys** - 5-10 min vs 20+ min  
✅ **Cheaper** - $10-15/month vs $85/month  
✅ **Simpler debugging** - Check Lambda logs directly  
✅ **Same functionality** - All vulnerabilities work  

## Trade-offs

❌ **Cold starts** - First request ~1-2 seconds  
❌ **Less "enterprise"** - Lambda vs containers  
❌ **15 min timeout** - Fine for this use case  

## How It Works

### Single Lambda Function
All API routes in one file (`lambda/index.ts`):
- Simple routing based on `rawPath` and `method`
- Direct database queries (intentionally vulnerable)
- No Express.js overhead
- Returns JSON responses

### Lambda Function URL
- No API Gateway needed
- Direct HTTPS endpoint
- Built-in CORS support
- CloudFront proxies `/api/*` to it

### CDK Bundling
CDK automatically:
- Installs npm dependencies
- Compiles TypeScript
- Bundles everything
- Deploys to Lambda

## Cleanup

```bash
cd infrastructure
npm run destroy
```

Or manually:
```bash
aws cloudformation delete-stack --stack-name SimpleVulnerableDemoStack
```

## Comparison

| Feature | Complex (ECS) | Simple (Lambda) |
|---------|---------------|-----------------|
| Backend files | 15+ | 1 |
| Backend LOC | ~800 | ~250 |
| CDK LOC | ~350 | ~150 |
| AWS resources | 15+ | 5 |
| Deploy time | 20+ min | 5-10 min |
| Cost/month | $85 | $10-15 |
| Docker | Yes | No |
| Health checks | Yes (problematic) | No |
| Cold starts | No | Yes (~1-2s) |

## When to Use Each

**Use Simple (Lambda):**
- ✅ Demo/educational purposes
- ✅ Low traffic (<1M requests/month)
- ✅ Cost-sensitive
- ✅ Quick iterations
- ✅ Learning AWS

**Use Complex (ECS):**
- ✅ Production workloads
- ✅ High traffic
- ✅ Need consistent latency
- ✅ Long-running processes
- ✅ "Enterprise" architecture

## Testing

Same as complex version - all vulnerabilities work identically:

```bash
# SQL Injection
curl https://your-domain.cloudfront.net/api/profile/1%27%20OR%20%271%27%3D%271

# XSS
curl -X POST https://your-domain.cloudfront.net/api/comments \
  -H "Content-Type: application/json" \
  -d '{"content":"<script>alert(1)</script>"}'

# Command Injection
curl -X POST https://your-domain.cloudfront.net/api/tools/ping \
  -H "Content-Type: application/json" \
  -d '{"host":"127.0.0.1; ls -la"}'
```

## Logs

View Lambda logs:
```bash
aws logs tail /aws/lambda/SimpleVulnerableDemoStack-ApiFunction --follow
```

## Updating

To update the Lambda code:
```bash
cd infrastructure
npm run deploy
```

CDK automatically rebuilds and redeploys the Lambda function.

## Conclusion

This simplified version proves you don't need complex infrastructure for a demo app. Lambda + Function URLs provide the same functionality with 90% less code and complexity.

**Recommendation:** Use this version unless you specifically need to demonstrate ECS/container architecture.
