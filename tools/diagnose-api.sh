#!/bin/bash
# Diagnostic script for API Gateway 500 errors
# Usage: ./tools/diagnose-api.sh [profile]

PROFILE="${1:-dev-security-agent-demo}"
REGION="us-east-1"
API_URL="https://isznznfp27.execute-api.us-east-1.amazonaws.com/prod"

echo "=== API Direct Test (no auth, security endpoint) ==="
curl -s -w "\nHTTP_CODE: %{http_code}\nTIME: %{time_total}s\n" "$API_URL/security-health" 2>&1
echo ""

echo "=== API Opportunities Test (no auth, expect 401 or 500) ==="
curl -s -w "\nHTTP_CODE: %{http_code}\nTIME: %{time_total}s\n" "$API_URL/opportunities" 2>&1
echo ""

echo "=== Lambda Function Name ==="
aws lambda list-functions \
  --query "Functions[?contains(FunctionName, 'proxyFunction') || contains(FunctionName, 'proxy')].{Name:FunctionName,Runtime:Runtime,Timeout:Timeout,Memory:MemorySize}" \
  --output table --region "$REGION" --profile "$PROFILE" 2>&1
echo ""

echo "=== Lambda Environment Variables ==="
FUNC_NAME=$(aws lambda list-functions \
  --query "Functions[?contains(FunctionName, 'proxyFunction')].FunctionName" \
  --output text --region "$REGION" --profile "$PROFILE" 2>&1)
if [ -n "$FUNC_NAME" ] && [ "$FUNC_NAME" != "None" ]; then
  echo "Function: $FUNC_NAME"
  aws lambda get-function-configuration \
    --function-name "$FUNC_NAME" \
    --query "Environment.Variables" \
    --output json --region "$REGION" --profile "$PROFILE" 2>&1
else
  echo "Could not find proxy function"
fi
echo ""

echo "=== Recent Lambda Logs (last 5 min) ==="
LOG_GROUP="/aws/lambda/$FUNC_NAME"
aws logs tail "$LOG_GROUP" --since 5m --region "$REGION" --profile "$PROFILE" 2>&1 | tail -50
echo ""

echo "=== RDS Proxy Status ==="
aws rds describe-db-proxies \
  --query "DBProxies[?contains(DBProxyName, 'sec-agent')].{Name:DBProxyName,Status:Status,Endpoint:Endpoint}" \
  --output table --region "$REGION" --profile "$PROFILE" 2>&1
echo ""

echo "=== RDS Instance Status ==="
aws rds describe-db-instances \
  --query "DBInstances[?contains(DBInstanceIdentifier, 'database')].{ID:DBInstanceIdentifier,Status:DBInstanceStatus,Port:Endpoint.Port,Address:Endpoint.Address}" \
  --output table --region "$REGION" --profile "$PROFILE" 2>&1
echo ""

echo "=== Secret Rotation Status ==="
aws secretsmanager list-secrets \
  --query "SecretList[?contains(Name, 'database') || contains(Name, 'rds')].{Name:Name,RotationEnabled:RotationEnabled,LastRotated:LastRotatedDate}" \
  --output table --region "$REGION" --profile "$PROFILE" 2>&1
