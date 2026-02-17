#!/bin/bash

# End-to-End Deployment Validation Script
# Tests complete user flow through CloudFront and verifies all vulnerabilities

set -e

echo "🔍 AWS Security Agent Demo - Deployment Validation"
echo "=================================================="
echo ""

# Configuration
STACK_NAME="VulnerableDemoStack"
AWS_REGION=${AWS_REGION:-us-west-2}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((TESTS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

# Get CloudFront URL
echo "📋 Fetching deployment information..."
if ! aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION &> /dev/null; then
    echo -e "${RED}❌ Error: Stack '$STACK_NAME' not found${NC}"
    echo "Please deploy infrastructure first: cd infrastructure && npm run deploy"
    exit 1
fi

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
    --output text)

if [ -z "$CLOUDFRONT_URL" ]; then
    echo -e "${RED}❌ Error: Could not retrieve CloudFront URL${NC}"
    exit 1
fi

echo "🌐 Application URL: $CLOUDFRONT_URL"
echo ""

# Test 1: CloudFront Distribution
echo "Test 1: CloudFront Distribution Accessibility"
echo "----------------------------------------------"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    pass "CloudFront distribution is accessible (HTTP $HTTP_CODE)"
else
    fail "CloudFront distribution returned HTTP $HTTP_CODE"
fi
echo ""

# Test 2: Health Check Endpoint
echo "Test 2: Backend Health Check"
echo "-----------------------------"
HEALTH_RESPONSE=$(curl -s "$CLOUDFRONT_URL/api/health")
if echo "$HEALTH_RESPONSE" | jq -e '.status' > /dev/null 2>&1; then
    HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status')
    if [ "$HEALTH_STATUS" = "healthy" ]; then
        pass "Health check endpoint returned healthy status"
        
        # Check database
        DB_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.checks.database.status')
        if [ "$DB_STATUS" = "ok" ]; then
            pass "Database connection is healthy"
        else
            fail "Database connection is unhealthy: $(echo "$HEALTH_RESPONSE" | jq -r '.checks.database.error')"
        fi
        
        # Check Cognito
        COGNITO_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.checks.cognito.status')
        if [ "$COGNITO_STATUS" = "ok" ]; then
            pass "Cognito configuration is healthy"
        else
            fail "Cognito configuration is unhealthy: $(echo "$HEALTH_RESPONSE" | jq -r '.checks.cognito.error')"
        fi
    else
        fail "Health check returned unhealthy status"
    fi
else
    fail "Health check endpoint did not return valid JSON"
fi
echo ""

# Test 3: Frontend Static Assets
echo "Test 3: Frontend Static Assets"
echo "-------------------------------"

# Test index.html
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL/index.html")
if [ "$HTTP_CODE" = "200" ]; then
    pass "index.html is accessible"
else
    fail "index.html returned HTTP $HTTP_CODE"
fi

# Test login page
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL/pages/login.html")
if [ "$HTTP_CODE" = "200" ]; then
    pass "Login page is accessible"
else
    fail "Login page returned HTTP $HTTP_CODE"
fi

# Test dashboard page
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL/pages/dashboard.html")
if [ "$HTTP_CODE" = "200" ]; then
    pass "Dashboard page is accessible"
else
    fail "Dashboard page returned HTTP $HTTP_CODE"
fi

# Test CSS
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL/assets/styles.css")
if [ "$HTTP_CODE" = "200" ]; then
    pass "CSS stylesheet is accessible"
else
    fail "CSS stylesheet returned HTTP $HTTP_CODE"
fi

# Test JavaScript
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL/assets/config.js")
if [ "$HTTP_CODE" = "200" ]; then
    pass "JavaScript config is accessible"
else
    fail "JavaScript config returned HTTP $HTTP_CODE"
fi
echo ""

# Test 4: SQL Injection Endpoint
echo "Test 4: SQL Injection Vulnerability"
echo "------------------------------------"
SQL_RESPONSE=$(curl -s "$CLOUDFRONT_URL/api/profile/1")
if echo "$SQL_RESPONSE" | jq -e '.' > /dev/null 2>&1; then
    pass "SQL injection endpoint is accessible"
    
    # Test with injection payload
    SQL_INJECTION_RESPONSE=$(curl -s "$CLOUDFRONT_URL/api/profile/1%27%20OR%20%271%27%3D%271")
    if [ -n "$SQL_INJECTION_RESPONSE" ]; then
        pass "SQL injection endpoint accepts injection payloads"
    else
        warn "SQL injection endpoint may not be vulnerable as expected"
    fi
else
    fail "SQL injection endpoint did not return valid response"
fi
echo ""

# Test 5: XSS Endpoints
echo "Test 5: XSS Vulnerabilities"
echo "---------------------------"

# Test comments endpoint (stored XSS)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL/api/comments")
if [ "$HTTP_CODE" = "200" ]; then
    pass "Comments endpoint (stored XSS) is accessible"
else
    fail "Comments endpoint returned HTTP $HTTP_CODE"
fi

# Test XSS pages
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL/pages/comments.html")
if [ "$HTTP_CODE" = "200" ]; then
    pass "XSS demo page is accessible"
else
    fail "XSS demo page returned HTTP $HTTP_CODE"
fi

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL/pages/xss-advanced.html")
if [ "$HTTP_CODE" = "200" ]; then
    pass "Advanced XSS demo page is accessible"
else
    fail "Advanced XSS demo page returned HTTP $HTTP_CODE"
fi
echo ""

# Test 6: Command Injection Endpoint
echo "Test 6: Command Injection Vulnerability"
echo "----------------------------------------"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL/pages/tools.html")
if [ "$HTTP_CODE" = "200" ]; then
    pass "Command injection demo page is accessible"
else
    fail "Command injection demo page returned HTTP $HTTP_CODE"
fi

# Test ping endpoint
PING_RESPONSE=$(curl -s -X POST "$CLOUDFRONT_URL/api/tools/ping" \
    -H "Content-Type: application/json" \
    -d '{"host":"127.0.0.1"}')
if [ -n "$PING_RESPONSE" ]; then
    pass "Command injection endpoint is accessible"
else
    fail "Command injection endpoint did not respond"
fi
echo ""

# Test 7: CORS Configuration
echo "Test 7: CORS Configuration"
echo "--------------------------"
CORS_RESPONSE=$(curl -s -I -X OPTIONS "$CLOUDFRONT_URL/api/health" \
    -H "Origin: $CLOUDFRONT_URL" \
    -H "Access-Control-Request-Method: GET")
if echo "$CORS_RESPONSE" | grep -i "access-control-allow-origin" > /dev/null; then
    pass "CORS headers are configured"
else
    warn "CORS headers may not be configured (this is expected for CloudFront)"
fi
echo ""

# Test 8: Educational Content
echo "Test 8: Educational Content"
echo "---------------------------"

# Check profile page for vulnerability info
PROFILE_PAGE=$(curl -s "$CLOUDFRONT_URL/pages/profile.html")
if echo "$PROFILE_PAGE" | grep -i "SQL Injection" > /dev/null; then
    pass "Profile page contains SQL injection educational content"
else
    fail "Profile page missing educational content"
fi

# Check comments page for XSS info
COMMENTS_PAGE=$(curl -s "$CLOUDFRONT_URL/pages/comments.html")
if echo "$COMMENTS_PAGE" | grep -i "XSS\|Cross-Site Scripting" > /dev/null; then
    pass "Comments page contains XSS educational content"
else
    fail "Comments page missing educational content"
fi

# Check tools page for command injection info
TOOLS_PAGE=$(curl -s "$CLOUDFRONT_URL/pages/tools.html")
if echo "$TOOLS_PAGE" | grep -i "Command Injection" > /dev/null; then
    pass "Tools page contains command injection educational content"
else
    fail "Tools page missing educational content"
fi
echo ""

# Summary
echo "=================================================="
echo "Validation Summary"
echo "=================================================="
echo ""
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All validation tests passed!${NC}"
    echo ""
    echo "🎉 Deployment is successful and ready for testing"
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Access the application: $CLOUDFRONT_URL"
    echo "   2. Login with credentials: demouser / DemoPass123!"
    echo "   3. Explore the vulnerability demonstrations"
    echo "   4. Test with AWS Security Agent"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some validation tests failed${NC}"
    echo ""
    echo "Please review the failures above and check:"
    echo "   - Infrastructure is fully deployed"
    echo "   - Backend is running on ECS"
    echo "   - Frontend is uploaded to S3"
    echo "   - Database is accessible"
    echo "   - Cognito is configured"
    echo ""
    echo "For troubleshooting, see DEPLOYMENT.md"
    echo ""
    exit 1
fi
