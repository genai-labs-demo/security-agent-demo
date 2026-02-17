#!/bin/bash

# Resume Deployment Script
# Continues deployment after infrastructure stack is complete

set -e

echo "🔄 Resuming AWS Security Agent Demo Deployment"
echo "=============================================="
echo ""

# Configuration
STACK_NAME="VulnerableDemoStack"
AWS_REGION=${AWS_REGION:-us-west-2}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check stack status
echo "📋 Checking CloudFormation stack status..."
STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$STACK_STATUS" = "NOT_FOUND" ]; then
    echo -e "${RED}❌ Stack not found${NC}"
    echo "Please run ./deploy-all.sh first"
    exit 1
fi

if [ "$STACK_STATUS" = "CREATE_IN_PROGRESS" ]; then
    echo -e "${YELLOW}⏳ Stack is still being created (status: $STACK_STATUS)${NC}"
    echo ""
    echo "Waiting for stack to complete..."
    echo "This may take 10-15 minutes. You can monitor progress at:"
    echo "https://console.aws.amazon.com/cloudformation"
    echo ""
    
    aws cloudformation wait stack-create-complete \
        --stack-name $STACK_NAME \
        --region $AWS_REGION
    
    echo -e "${GREEN}✅ Stack creation complete${NC}"
fi

if [ "$STACK_STATUS" != "CREATE_COMPLETE" ] && [ "$STACK_STATUS" != "UPDATE_COMPLETE" ]; then
    echo -e "${RED}❌ Stack is in unexpected state: $STACK_STATUS${NC}"
    echo "Please check the CloudFormation console for errors"
    exit 1
fi

echo -e "${GREEN}✅ Stack is ready (status: $STACK_STATUS)${NC}"
echo ""

# Get stack outputs
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
echo "Step 1: Setting Up Cognito Users"
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
echo "Step 2: Configuring Backend Environment"
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
echo "Step 3: Setting Up Database"
echo "================================================="
echo ""

cd backend
npm run db:setup
cd ..

echo -e "${GREEN}✅ Database initialized${NC}"
echo ""

echo ""
echo "================================================="
echo "Step 4: Building and Deploying Backend"
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
echo "Step 5: Configuring Frontend"
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
echo "Step 6: Deploying Frontend"
echo "================================================="
echo ""

cd frontend
npm run deploy
cd ..

echo -e "${GREEN}✅ Frontend deployed${NC}"
echo ""

echo ""
echo "================================================="
echo "Step 7: Running Validation Tests"
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
