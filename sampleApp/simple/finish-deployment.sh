#!/bin/bash

# Complete the deployment after CDK stack is created

set -e

STACK_NAME="SimpleVulnerableDemoStack"
AWS_REGION="us-west-2"

echo "Finishing deployment..."
echo ""

# Get stack outputs
echo "Retrieving stack outputs..."
CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' --output text)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' --output text)

echo "CloudFront URL: $CLOUDFRONT_URL"
echo "User Pool ID: $USER_POOL_ID"
echo "Bucket: $BUCKET_NAME"
echo ""

# Set Cognito passwords
echo "Setting Cognito user passwords..."
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username demouser \
  --password 'DemoPass123!' \
  --permanent \
  --region $AWS_REGION

aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username admin \
  --password 'AdminPass123!' \
  --permanent \
  --region $AWS_REGION

echo "✅ Cognito users configured"
echo ""

# Update frontend config
echo "Updating frontend configuration..."
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

echo "✅ Frontend config updated"
echo ""

# Deploy frontend
echo "Deploying frontend to S3..."
aws s3 sync ../frontend/ s3://$BUCKET_NAME/ --delete --exclude "package.json"

echo "✅ Frontend deployed"
echo ""

# Invalidate CloudFront
echo "Invalidating CloudFront cache..."
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?DomainName=='$(echo $CLOUDFRONT_URL | sed 's|https://||')'].Id" --output text)
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*" >/dev/null

echo "✅ CloudFront cache invalidated"
echo ""

# Test health endpoint
echo "Testing health endpoint (this initializes the database)..."
sleep 5
curl -s $CLOUDFRONT_URL/api/health | jq . || echo "Health check response received"

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "Application URL: $CLOUDFRONT_URL"
echo ""
echo "Credentials:"
echo "  Username: demouser"
echo "  Password: DemoPass123!"
echo ""
echo "  Username: admin"
echo "  Password: AdminPass123!"
echo ""
