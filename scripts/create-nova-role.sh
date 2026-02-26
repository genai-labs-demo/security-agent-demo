#!/bin/bash
# Creates the NovaDomainServiceRoute53Role if it doesn't already exist.
# Run this before CDK deploy if you need the role immediately.

ROLE_NAME="NovaDomainServiceRoute53Role"
NOVA_ACCOUNT="791674550530"

echo "Checking if role $ROLE_NAME exists..."
if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    echo "Role $ROLE_NAME already exists. Skipping creation."
    exit 0
fi

echo "Creating role $ROLE_NAME..."
aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "{
        \"Version\": \"2012-10-17\",
        \"Statement\": [{
            \"Effect\": \"Allow\",
            \"Principal\": {\"AWS\": \"arn:aws:iam::${NOVA_ACCOUNT}:root\"},
            \"Action\": \"sts:AssumeRole\"
        }]
    }" \
    --description "Allows NovaDomainService to manage Route 53 hosted zones for people.aws.dev domains"

echo "Attaching inline policy..."
aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name "Route53HostedZoneManagement" \
    --policy-document '{
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Action": [
                "route53:CreateHostedZone",
                "route53:DeleteHostedZone",
                "route53:GetHostedZone",
                "route53:ListHostedZones",
                "route53:ListHostedZonesByName",
                "route53:ChangeResourceRecordSets",
                "route53:ListResourceRecordSets",
                "route53:GetChange"
            ],
            "Resource": "*"
        }]
    }'

echo "Done. Role $ROLE_NAME created successfully."
echo "Role ARN: $(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)"
