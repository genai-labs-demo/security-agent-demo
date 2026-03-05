#!/bin/bash
# Diagnostic script for the 500 error on /opportunities
# Run with: bash tools/diagnose-db.sh <aws-profile>
# Example: bash tools/diagnose-db.sh dev-security-agent-demo

PROFILE="${1:-dev-security-agent-demo}"
REGION="us-east-1"
OPTS="--profile $PROFILE --region $REGION --output json"

echo "=== 1. Check AWS Identity ==="
aws sts get-caller-identity $OPTS 2>&1 | head -5

echo ""
echo "=== 2. Find the backend stack ==="
STACK=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE $OPTS \
  --query "StackSummaries[?contains(StackName, 'backend')].StackName" --output text 2>&1)
echo "Backend stack: $STACK"

echo ""
echo "=== 3. Find the Lambda proxy function ==="
LAMBDA=$(aws lambda list-functions $OPTS \
  --query "Functions[?contains(FunctionName, 'proxyFunction')].FunctionName" --output text 2>&1)
echo "Lambda function: $LAMBDA"

if [ -n "$LAMBDA" ] && [ "$LAMBDA" != "None" ]; then
  echo ""
  echo "=== 4. Lambda environment variables ==="
  aws lambda get-function-configuration --function-name "$LAMBDA" $OPTS \
    --query "Environment.Variables" 2>&1

  echo ""
  echo "=== 5. Lambda VPC config ==="
  aws lambda get-function-configuration --function-name "$LAMBDA" $OPTS \
    --query "{SubnetIds: VpcConfig.SubnetIds, SecurityGroupIds: VpcConfig.SecurityGroupIds}" 2>&1

  echo ""
  echo "=== 6. Recent Lambda errors (last 15 min) ==="
  LOG_GROUP="/aws/lambda/$LAMBDA"
  aws logs tail "$LOG_GROUP" --since 15m --filter-pattern "ERROR" $OPTS 2>&1 | tail -30
  
  echo ""
  echo "=== 7. Recent Lambda invocations (last 5 min) ==="
  aws logs tail "$LOG_GROUP" --since 5m $OPTS 2>&1 | tail -50
fi

echo ""
echo "=== 8. Find RDS Proxy ==="
aws rds describe-db-proxies --db-proxy-name sec-agent-database-proxy $OPTS \
  --query "DBProxies[0].{Status: Status, Endpoint: Endpoint, VpcId: VpcId}" 2>&1

echo ""
echo "=== 9. RDS Proxy target health ==="
aws rds describe-db-proxy-targets --db-proxy-name sec-agent-database-proxy $OPTS \
  --query "Targets[0].{State: TargetHealth.State, Reason: TargetHealth.Reason, Description: TargetHealth.Description}" 2>&1

echo ""
echo "=== 10. Find the DB secret ==="
SECRET=$(aws secretsmanager list-secrets $OPTS \
  --query "SecretList[?contains(Name, 'database') && contains(Name, 'Secret')].{Name: Name, ARN: ARN}" 2>&1)
echo "$SECRET"

SECRET_ARN=$(echo "$SECRET" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data[0]['ARN'] if data else '')" 2>/dev/null)
if [ -n "$SECRET_ARN" ]; then
  echo ""
  echo "=== 11. Secret value (port and username only) ==="
  aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" $OPTS \
    --query "SecretString" --output text 2>&1 | python3 -c "
import sys, json
s = json.loads(sys.stdin.read())
print(f'username: {s.get(\"username\")}')
print(f'port: {s.get(\"port\")}')
print(f'host: {s.get(\"host\")}')
print(f'dbname: {s.get(\"dbname\", \"N/A\")}')
print(f'engine: {s.get(\"engine\", \"N/A\")}')
print(f'password length: {len(s.get(\"password\", \"\"))}')
" 2>&1
fi

echo ""
echo "=== 12. RDS instance status ==="
aws rds describe-db-instances $OPTS \
  --query "DBInstances[?contains(DBInstanceIdentifier, 'database')].{Id: DBInstanceIdentifier, Status: DBInstanceStatus, Port: Endpoint.Port, Address: Endpoint.Address}" 2>&1

echo ""
echo "=== Done ==="
