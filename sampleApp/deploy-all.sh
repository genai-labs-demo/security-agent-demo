#!/bin/bash

# Complete Deployment Script
# Deploys infrastructure, backend, and frontend in sequence

set -e

echo "🚀 AWS Security Agent Demo - Complete Deployment"
echo "================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found${NC}"
    echo "Please install AWS CLI: https://aws.amazon.com/cli/"
    exit 1
fi
echo -e "${GREEN}✅${NC} AWS CLI installed"

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    echo "Please configure AWS CLI: aws configure"
    exit 1
fi
echo -e "${GREEN}✅${NC} AWS credentials configured"

# Check CDK
if ! command -v cdk &> /dev/null; then
    echo -e "${RED}❌ AWS CDK not found${NC}"
    echo "Please install CDK: npm install -g aws-cdk"
    exit 1
fi
echo -e "${GREEN}✅${NC} AWS CDK installed"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found${NC}"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✅${NC} Docker installed"

# Check Docker daemon
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon not running${NC}"
    echo "Please start Docker"
    exit 1
fi
echo -e "${GREEN}✅${NC} Docker daemon running"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    echo "Please install Node.js 18+: https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✅${NC} Node.js installed"

echo ""
echo "All prerequisites met!"
echo ""

# Confirm deployment
echo -e "${YELLOW}⚠️  WARNING${NC}: This will deploy AWS resources that may incur costs"
echo ""
read -p "Do you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "================================================="
echo "Step 1: Installing Dependencies"
echo "================================================="
echo ""

npm install

echo ""
echo "================================================="
echo "Step 2: Deploying Infrastructure (CDK)"
echo "================================================="
echo ""

cd infrastructure
npm run build
npm run deploy -- --require-approval never
cd ..

echo ""
echo -e "${GREEN}✅ Infrastructure deployed${NC}"
echo ""

# Get stack outputs
STACK_NAME="VulnerableDemoStack"
AWS_REGION=${AWS_REGION:-us-west-2}

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

DB_SECRET_ARN=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`DatabaseSecretArn`].OutputValue' \
    --output text)

echo ""
echo "Deployment Information:"
echo "  CloudFront URL: $CLOUDFRONT_URL"
echo "  User Pool ID: $USER_POOL_ID"
echo "  Database Endpoint: $DB_ENDPOINT"
echo ""

echo ""
echo "================================================="
echo "Step 3: Setting Up Cognito Users"
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

echo ""
echo "================================================="
echo "Step 4: Configuring Backend Environment"
echo "================================================="
echo ""

# Get database password
DB_PASSWORD=$(aws secretsmanager get-secret-value \
    --secret-id $DB_SECRET_ARN \
    --region $AWS_REGION \
    --query SecretString \
    --output text | jq -r .password)

# Update backend .env
cat > backend/.env << EOF
# AWS Infrastructure Configuration
# Generated from CloudFormation Stack: $STACK_NAME

# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration (RDS PostgreSQL)
DB_HOST=$DB_ENDPOINT
DB_PORT=5432
DB_NAME=vulnerabledemodb
DB_USER=dbadmin
DB_PASSWORD=$DB_PASSWORD

# AWS Cognito Configuration
USER_POOL_ID=$USER_POOL_ID
USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
AWS_REGION=$AWS_REGION

# CORS Configuration
CORS_ORIGINS=$CLOUDFRONT_URL
EOF

echo -e "${GREEN}✅ Backend environment configured${NC}"
echo ""

echo ""
echo "================================================="
echo "Step 5: Setting Up Database"
echo "================================================="
echo ""

cd backend
npm run db:setup
cd ..

echo -e "${GREEN}✅ Database initialized${NC}"
echo ""

echo ""
echo "================================================="
echo "Step 6: Building and Deploying Backend"
echo "================================================="
echo ""

cd backend
npm run build
npm run deploy
cd ..

echo -e "${GREEN}✅ Backend deployed${NC}"
echo ""

echo ""
echo "================================================="
echo "Step 7: Configuring Frontend"
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
echo ""

echo ""
echo "================================================="
echo "Step 8: Deploying Frontend"
echo "================================================="
echo ""

cd frontend
npm run deploy
cd ..

echo -e "${GREEN}✅ Frontend deployed${NC}"
echo ""

echo ""
echo "================================================="
echo "Step 9: Running Validation Tests"
echo "================================================="
echo ""

# Wait a bit for everything to stabilize
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
echo "For more information, see DEPLOYMENT.md"
echo ""
