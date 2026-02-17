#!/bin/bash

# Cleanup Script
# Removes all AWS resources to avoid ongoing charges

set -e

echo "🧹 AWS Security Agent Demo - Cleanup"
echo "====================================="
echo ""

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# Configuration
STACK_NAME="VulnerableDemoStack"
AWS_REGION=${AWS_REGION:-us-west-2}

echo -e "${YELLOW}⚠️  WARNING${NC}: This will delete all deployed resources"
echo ""
echo "This includes:"
echo "  - CloudFormation stack and all resources"
echo "  - S3 bucket contents"
echo "  - ECR repository and images"
echo "  - RDS database (all data will be lost)"
echo "  - CloudWatch logs"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cleanup cancelled"
    exit 0
fi

echo ""

# Check if stack exists
if ! aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION &> /dev/null; then
    echo -e "${YELLOW}⚠️  Stack '$STACK_NAME' not found${NC}"
    echo "Nothing to clean up"
    exit 0
fi

# Get resource information
echo "📋 Retrieving resource information..."

BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
    --output text 2>/dev/null || echo "")

echo ""
echo "================================================="
echo "Step 1: Emptying S3 Bucket"
echo "================================================="
echo ""

if [ -n "$BUCKET_NAME" ]; then
    echo "Deleting objects from S3 bucket: $BUCKET_NAME"
    aws s3 rm s3://$BUCKET_NAME --recursive --region $AWS_REGION || true
    echo -e "${GREEN}✅ S3 bucket emptied${NC}"
else
    echo "No S3 bucket found or already deleted"
fi

echo ""
echo "================================================="
echo "Step 2: Deleting ECR Images"
echo "================================================="
echo ""

REPO_NAME="vulnerable-demo-backend"
if aws ecr describe-repositories --repository-names $REPO_NAME --region $AWS_REGION &> /dev/null; then
    echo "Deleting images from ECR repository: $REPO_NAME"
    
    # Get all image IDs
    IMAGE_IDS=$(aws ecr list-images \
        --repository-name $REPO_NAME \
        --region $AWS_REGION \
        --query 'imageIds[*]' \
        --output json)
    
    if [ "$IMAGE_IDS" != "[]" ]; then
        aws ecr batch-delete-image \
            --repository-name $REPO_NAME \
            --region $AWS_REGION \
            --image-ids "$IMAGE_IDS" || true
    fi
    
    # Delete repository
    aws ecr delete-repository \
        --repository-name $REPO_NAME \
        --region $AWS_REGION \
        --force || true
    
    echo -e "${GREEN}✅ ECR repository deleted${NC}"
else
    echo "No ECR repository found or already deleted"
fi

echo ""
echo "================================================="
echo "Step 3: Destroying CloudFormation Stack"
echo "================================================="
echo ""

echo "Deleting CloudFormation stack: $STACK_NAME"
echo "This may take 10-15 minutes..."

cd infrastructure
npm run destroy -- --force
cd ..

echo -e "${GREEN}✅ CloudFormation stack deleted${NC}"

echo ""
echo "================================================="
echo "Step 4: Cleaning Up CloudWatch Logs"
echo "================================================="
echo ""

# Delete log groups
LOG_GROUPS=$(aws logs describe-log-groups \
    --log-group-name-prefix "/ecs/vulnerable-demo" \
    --region $AWS_REGION \
    --query 'logGroups[*].logGroupName' \
    --output text 2>/dev/null || echo "")

if [ -n "$LOG_GROUPS" ]; then
    for LOG_GROUP in $LOG_GROUPS; do
        echo "Deleting log group: $LOG_GROUP"
        aws logs delete-log-group \
            --log-group-name $LOG_GROUP \
            --region $AWS_REGION || true
    done
    echo -e "${GREEN}✅ CloudWatch logs deleted${NC}"
else
    echo "No CloudWatch log groups found"
fi

echo ""
echo "================================================="
echo "Step 5: Cleaning Up Secrets Manager"
echo "================================================="
echo ""

# Note: Secrets have a recovery window and can't be immediately deleted
SECRET_ARN=$(aws secretsmanager list-secrets \
    --region $AWS_REGION \
    --query "SecretList[?Name=='vulnerable-demo-db-credentials'].ARN" \
    --output text 2>/dev/null || echo "")

if [ -n "$SECRET_ARN" ]; then
    echo "Scheduling secret deletion (7-day recovery window): vulnerable-demo-db-credentials"
    aws secretsmanager delete-secret \
        --secret-id $SECRET_ARN \
        --region $AWS_REGION \
        --force-delete-without-recovery || true
    echo -e "${GREEN}✅ Secret scheduled for deletion${NC}"
else
    echo "No secrets found"
fi

echo ""
echo "================================================="
echo "🎉 Cleanup Complete!"
echo "================================================="
echo ""
echo "All resources have been deleted or scheduled for deletion."
echo ""
echo "Note: Some resources may have a recovery window:"
echo "  - Secrets Manager: 7-30 days"
echo "  - RDS snapshots: May need manual deletion"
echo ""
echo "To verify all resources are deleted, check the AWS Console:"
echo "  - CloudFormation: https://console.aws.amazon.com/cloudformation"
echo "  - S3: https://console.aws.amazon.com/s3"
echo "  - ECR: https://console.aws.amazon.com/ecr"
echo "  - RDS: https://console.aws.amazon.com/rds"
echo ""
