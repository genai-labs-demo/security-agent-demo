#!/bin/bash

# Update Stack Script
# Updates the CloudFormation stack to fix the ECS service health check issue

set -e

echo "🔄 Updating CloudFormation Stack"
echo "================================="
echo ""

STACK_NAME="VulnerableDemoStack"
AWS_REGION=${AWS_REGION:-us-west-2}

echo "This will update the stack configuration to:"
echo "  - Add health check grace period (5 minutes)"
echo "  - Disable circuit breaker rollback"
echo "  - Allow the ECS service to complete creation"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled"
    exit 0
fi

echo ""
echo "Building updated CDK stack..."
cd infrastructure
npm run build

echo ""
echo "Deploying stack update..."
npm run deploy -- --require-approval never

cd ..

echo ""
echo "✅ Stack update initiated"
echo ""
echo "The update should complete in 2-3 minutes."
echo "Monitor at: https://console.aws.amazon.com/cloudformation"
echo ""
echo "Once complete, run: ./resume-deployment.sh"
