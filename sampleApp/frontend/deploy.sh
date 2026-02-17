#!/bin/bash

# Frontend Deployment Script
# Uploads frontend assets to S3 and invalidates CloudFront cache

set -e

echo "🚀 Starting frontend deployment..."

# Get stack outputs
echo "📋 Fetching CloudFormation stack outputs..."
STACK_NAME="VulnerableDemoStack"

# Check if stack exists
if ! aws cloudformation describe-stacks --stack-name $STACK_NAME &> /dev/null; then
    echo "❌ Error: Stack '$STACK_NAME' not found. Please deploy infrastructure first."
    echo "   Run: cd infrastructure && npm run deploy"
    exit 1
fi

# Get S3 bucket name and CloudFront distribution ID
BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
    --output text)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomain`].OutputValue' \
    --output text | cut -d'.' -f1)

# Get full distribution ID
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?DomainName=='$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomain`].OutputValue' --output text)'].Id" \
    --output text)

if [ -z "$BUCKET_NAME" ]; then
    echo "❌ Error: Could not retrieve S3 bucket name from stack outputs"
    exit 1
fi

echo "✅ S3 Bucket: $BUCKET_NAME"
echo "✅ CloudFront Distribution: $DISTRIBUTION_ID"

# Upload files to S3
echo ""
echo "📦 Uploading frontend files to S3..."

# Upload index.html
aws s3 cp index.html s3://$BUCKET_NAME/index.html \
    --content-type "text/html" \
    --cache-control "no-cache, no-store, must-revalidate"

# Upload pages
aws s3 sync pages/ s3://$BUCKET_NAME/pages/ \
    --content-type "text/html" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --delete

# Upload assets (CSS, JS)
aws s3 sync assets/ s3://$BUCKET_NAME/assets/ \
    --cache-control "max-age=31536000" \
    --delete

echo "✅ Files uploaded successfully"

# Invalidate CloudFront cache
if [ -n "$DISTRIBUTION_ID" ]; then
    echo ""
    echo "🔄 Invalidating CloudFront cache..."
    
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id $DISTRIBUTION_ID \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text)
    
    echo "✅ CloudFront invalidation created: $INVALIDATION_ID"
    echo "   Note: Invalidation may take a few minutes to complete"
else
    echo "⚠️  Warning: Could not retrieve CloudFront distribution ID"
    echo "   Cache invalidation skipped"
fi

# Get CloudFront URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
    --output text)

echo ""
echo "✅ Frontend deployment complete!"
echo ""
echo "🌐 Application URL: $CLOUDFRONT_URL"
echo ""
