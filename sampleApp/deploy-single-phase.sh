#!/bin/bash

# Single-Phase Deployment Script
# Builds Docker image and deploys everything in one go using CDK Docker assets

set -e

echo "🚀 AWS Security Agent Demo - Single-Phase Deployment"
echo "====================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅${NC} AWS CLI installed"

if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    exit 1
fi
echo -e "${GREEN}✅${NC} AWS credentials configured"

if ! command -v cdk &> /dev/null; then
    echo -e "${RED}❌ AWS CDK not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅${NC} AWS CDK installed"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅${NC} Docker installed"

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon not running${NC}"
    exit 1
fi
echo -e "${GREEN}✅${NC} Docker daemon running"

echo ""
echo "All prerequisites met!"
echo ""

# Confirm deployment
echo -e "${YELLOW}⚠️  WARNING${NC}: This will deploy AWS resources that may incur costs (~$85-90/month)"
echo ""
read -p "Do you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Deployment cancelled"
    exit 0
fi

# Configuration
STACK_NAME="VulnerableDemoStack"
AWS_REGION=${AWS_REGION:-us-west-2}

echo ""
echo "================================================="
echo "Step 1: Installing Dependencies"
echo "================================================="
echo ""

npm install

echo ""
echo "================================================="
echo "Step 2: Building Backend"
echo "================================================="
echo ""

cd backend
npm run build
cd ..

echo -e "${GREEN}✅ Backend built${NC}"

echo ""
echo "================================================="
echo "Step 3: Deploying Infrastructure with CDK"
echo "================================================="
echo ""
echo "This will:"
echo "  - Build and push Docker image to ECR"
echo "  - Create all AWS infrastructure"
echo "  - Deploy backend application"
echo ""
echo "This may take 15-20 minutes..."
echo ""

cd infrastructure
npm run build
npm run deploy -- --require-approval never
cd ..

echo -e "${GREEN}✅ Infrastructure and backend deployed${NC}"

# Get stack outputs
echo ""
echo "📋 Retrieving deployment information..."

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
    --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
    --output text)

DB_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
    --output text)

echo ""
echo "Deployment Information:"
echo "  CloudFront URL: $CLOUDFRONT_URL"
echo "  User Pool ID: $USER_POOL_ID"
echo "  Database Endpoint: $DB_ENDPOINT"
echo ""

echo ""
echo "================================================="
echo "Step 4: Setting Up Cognito Users"
echo "================================================="
echo ""

echo "Setting password for demouser..."
aws cognito-idp admin-set-user-password \
    --user-pool-id $USER_POOL_ID \
    --username demouser \
    --password "DemoPass123!" \
    --permanent \
    --region $AWS_REGION

echo "Setting password for admin..."
aws cognito-idp admin-set-user-password \
    --user-pool-id $USER_POOL_ID \
    --username admin \
    --password "AdminPass123!" \
    --permanent \
    --region $AWS_REGION

echo -e "${GREEN}✅ Cognito users configured${NC}"

echo ""
echo "================================================="
echo "Step 5: Setting Up Database"
echo "================================================="
echo ""

# Get database password from Secrets Manager
DB_SECRET_ARN=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`DatabaseSecretArn`].OutputValue' \
    --output text)

DB_PASSWORD=$(aws secretsmanager get-secret-value \
    --secret-id $DB_SECRET_ARN \
    --region $AWS_REGION \
    --query SecretString \
    --output text | jq -r .password)

# Create temporary .env for database setup
cat > backend/.env.temp << EOF
DB_HOST=$DB_ENDPOINT
DB_PORT=5432
DB_NAME=vulnerabledemodb
DB_USER=dbadmin
DB_PASSWORD=$DB_PASSWORD
AWS_REGION=$AWS_REGION
EOF

# Run database setup
cd backend
export $(cat .env.temp | xargs)
npm run db:setup
rm .env.temp
cd ..

echo -e "${GREEN}✅ Database initialized${NC}"

echo ""
echo "================================================="
echo "Step 6: Configuring and Deploying Frontend"
echo "================================================="
echo ""

# Update frontend config
cat > frontend/assets/config.js << EOF
// API Configuration
const CONFIG = {
  API_BASE_URL: '$CLOUDFRONT_URL',
  COGNITO: {
    USER_POOL_ID: '$USER_POOL_ID',
    CLIENT_ID: '$USER_POOL_CLIENT_ID',
    REGION: '$AWS_REGION'
  }
};
EOF

echo -e "${GREEN}✅ Frontend configured${NC}"

# Deploy frontend
cd frontend
./deploy.sh
cd ..

echo -e "${GREEN}✅ Frontend deployed${NC}"

echo ""
echo "================================================="
echo "Step 7: Running Validation Tests"
echo "================================================="
echo ""

# Wait for services to stabilize
echo "Waiting 30 seconds for services to stabilize..."
sleep 30

./validate-deployment.sh

echo ""
echo "================================================="
echo "🎉 Deployment Complete!"
echo "================================================="
echo ""
echo "Application URL: $CLOUDFRONT_URL"
echo ""
echo "Test Credentials:"
echo "  Username: demouser"
echo "  Password: DemoPass123!"
echo ""
echo "  Username: admin"
echo "  Password: AdminPass123!"
echo ""
echo "Next Steps:"
echo "  1. Access the application at: $CLOUDFRONT_URL"
echo "  2. Login with the credentials above"
echo "  3. Explore the vulnerability demonstrations"
echo "  4. Test with AWS Security Agent"
echo ""
