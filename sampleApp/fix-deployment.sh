#!/bin/bash

# Fix Stuck Deployment
# Cancels the current stack creation and redeploys with a working configuration

set -e

echo "🔧 Fixing Stuck Deployment"
echo "=========================="
echo ""

STACK_NAME="VulnerableDemoStack"
AWS_REGION=${AWS_REGION:-us-west-2}

echo "⚠️  This will:"
echo "  1. Cancel the current stack creation"
echo "  2. Delete the incomplete stack"
echo "  3. Redeploy with a fixed configuration"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled"
    exit 0
fi

echo ""
echo "Step 1: Cancelling stack creation..."
aws cloudformation cancel-update-stack --stack-name $STACK_NAME --region $AWS_REGION 2>/dev/null || echo "No update to cancel"

echo "Waiting for stack to stabilize..."
sleep 10

echo ""
echo "Step 2: Deleting incomplete stack..."
aws cloudformation delete-stack --stack-name $STACK_NAME --region $AWS_REGION

echo "Waiting for stack deletion..."
aws cloudformation wait stack-delete-complete --stack-name $STACK_NAME --region $AWS_REGION

echo "✅ Stack deleted"
echo ""

echo "Step 3: Redeploying with fixed configuration..."
cd infrastructure
npm run deploy -- --require-approval never
cd ..

echo ""
echo "✅ Stack deployment initiated"
echo ""
echo "This will take 10-15 minutes. Monitor at:"
echo "https://console.aws.amazon.com/cloudformation"
echo ""
echo "Once complete, run: ./resume-deployment.sh"
