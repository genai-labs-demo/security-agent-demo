#!/bin/bash

# Simplified Single-Command Deployment
# Deploys everything with Lambda instead of ECS

set -e

echo "🚀 Simplified AWS Security Agent Demo Deployment"
echo "================================================"
echo ""

STACK_NAME="SimpleVulnerableDemoStack"
AWS_REGION=${AWS_REGION:-us-west-2}

# Check prerequisites
echo "Checking prerequisites..."
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI required"; exit 1; }
command -v cdk >/dev/null 2>&1 || { echo "❌ AWS CDK required"; exit 1; }
aws sts get-caller-identity >/dev/null 2>&1 || { echo "❌ AWS credentials not configured"; exit 1; }
echo "✅ Prerequisites met"
echo ""

# Confirm
echo "⚠️  This will deploy AWS resources (~$10-15/month)"
read -p "Continue? (yes/no): " CONFIRM
[ "$CONFIRM" != "yes" ] && exit 0

# Install dependencies
echo ""
echo "Installing dependencies..."
cd infrastructure && npm install && cd ..
cd lambda && npm install && cd ..

# Build Lambda function locally
echo ""
echo "Building Lambda function..."
cd lambda
npm run build
cd ..

# Create lambda-dist directory with compiled code and dependencies
echo "Packaging Lambda function..."
rm -rf lambda-dist
mkdir -p lambda-dist
cp -r lambda/dist/* lambda-dist/
cp -r lambda/node_modules lambda-dist/
cp lambda/package.json lambda-dist/

# Deploy
echo ""
echo "Deploying infrastructure (5-10 minutes)..."
cd infrastructure
npm run build
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/$AWS_REGION 2>/dev/null || true
npm run deploy -- --require-approval never
cd ..

# Get outputs
echo ""
echo "Retrieving outputs..."
CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' --output text)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
DB_ENDPOINT=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' --output text)
DB_SECRET_ARN=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`DatabaseSecretArn`].OutputValue' --output text)
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' --output text)

# Set Cognito passwords
echo ""
echo "Configuring Cognito users..."
aws cognito-idp admin-set-user-password --user-pool-id $USER_POOL_ID --username demouser --password "DemoPass123!" --permanent --region $AWS_REGION
aws cognito-idp admin-set-user-password --user-pool-id $USER_POOL_ID --username admin --password "AdminPass123!" --permanent --region $AWS_REGION

echo ""
echo "Note: Database will be initialized automatically on first Lambda invocation"

# Deploy frontend
echo ""
echo "Deploying frontend..."
# Update config
cat > ../frontend/assets/config.js << EOF
const CONFIG = {
  API_BASE_URL: '$CLOUDFRONT_URL',
  COGNITO: {
    USER_POOL_ID: '$USER_POOL_ID',
    CLIENT_ID: '$USER_POOL_CLIENT_ID',
    REGION: '$AWS_REGION'
  }
};
EOF

# Upload to S3
aws s3 sync ../frontend/ s3://$BUCKET_NAME/ --delete --exclude "package.json"

# Invalidate CloudFront
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?DomainName=='$(echo $CLOUDFRONT_URL | sed 's|https://||')'].Id" --output text)
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*" >/dev/null

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "Application URL: $CLOUDFRONT_URL"
echo ""
echo "Credentials:"
echo "  Username: demouser"
echo "  Password: DemoPass123!"
echo ""

# Cleanup
rm -rf lambda-dist
