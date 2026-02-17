#!/bin/bash

# Backend Deployment Script
# Builds Docker image and pushes to ECR, then updates ECS service

set -e

echo "🚀 Starting backend deployment..."

# Configuration
STACK_NAME="VulnerableDemoStack"
AWS_REGION=${AWS_REGION:-us-west-2}
IMAGE_TAG=${IMAGE_TAG:-latest}

# Check if stack exists
echo "📋 Checking CloudFormation stack..."
if ! aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION &> /dev/null; then
    echo "❌ Error: Stack '$STACK_NAME' not found. Please deploy infrastructure first."
    echo "   Run: cd infrastructure && npm run deploy"
    exit 1
fi

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "✅ AWS Account: $AWS_ACCOUNT_ID"

# Create ECR repository if it doesn't exist
REPO_NAME="vulnerable-demo-backend"
echo ""
echo "📦 Checking ECR repository..."

if ! aws ecr describe-repositories --repository-names $REPO_NAME --region $AWS_REGION &> /dev/null; then
    echo "Creating ECR repository: $REPO_NAME"
    aws ecr create-repository \
        --repository-name $REPO_NAME \
        --region $AWS_REGION \
        --image-scanning-configuration scanOnPush=false \
        --encryption-configuration encryptionType=AES256
    echo "✅ ECR repository created"
else
    echo "✅ ECR repository exists"
fi

# Get ECR login
echo ""
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build Docker image
echo ""
echo "🏗️  Building Docker image..."
docker build -t $REPO_NAME:$IMAGE_TAG .

# Tag image for ECR
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO_NAME:$IMAGE_TAG"
docker tag $REPO_NAME:$IMAGE_TAG $ECR_URI

# Push to ECR
echo ""
echo "📤 Pushing image to ECR..."
docker push $ECR_URI

echo "✅ Image pushed: $ECR_URI"

# Get ECS cluster and service names
echo ""
echo "🔍 Finding ECS cluster and service..."

CLUSTER_NAME=$(aws ecs list-clusters --region $AWS_REGION --query 'clusterArns[0]' --output text | rev | cut -d'/' -f1 | rev)
SERVICE_NAME=$(aws ecs list-services --cluster $CLUSTER_NAME --region $AWS_REGION --query 'serviceArns[0]' --output text | rev | cut -d'/' -f1 | rev)

if [ -z "$CLUSTER_NAME" ] || [ -z "$SERVICE_NAME" ]; then
    echo "⚠️  Warning: Could not find ECS cluster or service"
    echo "   You may need to update the task definition manually"
    echo ""
    echo "   Image URI: $ECR_URI"
    exit 0
fi

echo "✅ Cluster: $CLUSTER_NAME"
echo "✅ Service: $SERVICE_NAME"

# Get current task definition
echo ""
echo "📝 Updating task definition..."

TASK_DEFINITION_ARN=$(aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --region $AWS_REGION \
    --query 'services[0].taskDefinition' \
    --output text)

# Get task definition details
TASK_DEF=$(aws ecs describe-task-definition \
    --task-definition $TASK_DEFINITION_ARN \
    --region $AWS_REGION \
    --query 'taskDefinition')

# Update image in task definition
NEW_TASK_DEF=$(echo $TASK_DEF | jq --arg IMAGE "$ECR_URI" \
    '.containerDefinitions[0].image = $IMAGE | 
     del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')

# Register new task definition
NEW_TASK_DEF_ARN=$(echo $NEW_TASK_DEF | aws ecs register-task-definition \
    --cli-input-json file:///dev/stdin \
    --region $AWS_REGION \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

echo "✅ New task definition: $NEW_TASK_DEF_ARN"

# Update ECS service
echo ""
echo "🔄 Updating ECS service..."

aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --task-definition $NEW_TASK_DEF_ARN \
    --region $AWS_REGION \
    --force-new-deployment \
    > /dev/null

echo "✅ ECS service updated"

# Wait for deployment to complete
echo ""
echo "⏳ Waiting for deployment to stabilize (this may take a few minutes)..."

aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --region $AWS_REGION

echo ""
echo "✅ Backend deployment complete!"
echo ""
echo "🌐 Application is now running on ECS"
echo ""
