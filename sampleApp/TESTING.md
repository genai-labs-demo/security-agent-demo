# Testing Guide

This guide describes how to test the AWS Security Agent Demo Application.

## Automated Validation

Run the automated validation script to test all components:

```bash
npm run validate
```

This script tests:
1. CloudFront distribution accessibility
2. Backend health check endpoint
3. Database connectivity
4. Cognito configuration
5. Frontend static assets
6. SQL injection endpoint
7. XSS endpoints
8. Command injection endpoint
9. CORS configuration
10. Educational content presence

## Manual Testing

### 1. Access the Application

Navigate to your CloudFront URL (from CDK outputs):

```bash
https://your-cloudfront-domain.cloudfront.net
```

### 2. Test Authentication

**Login Page** (`/pages/login.html`):

1. Enter credentials:
   - Username: `demouser`
   - Password: `DemoPass123!`
2. Click "Login"
3. Should redirect to dashboard

**Test Invalid Credentials**:
1. Enter invalid username/password
2. Should show error message
3. Should not redirect

### 3. Test Infrastructure Status

**Dashboard** (`/pages/dashboard.html`):

1. Check "Infrastructure Status" section
2. Should show:
   - ✅ Database (RDS): Connected
   - ✅ Authentication (Cognito): Configured
   - ✅ Overall Status: All systems operational

### 4. Test SQL Injection Vulnerability

**Profile Page** (`/pages/profile.html`):

1. Navigate to "SQL Injection" demo
2. Read the vulnerability information
3. Try sample payloads:

**Basic Injection**:
```
User ID: 1' OR '1'='1
```
Expected: Should return multiple users or bypass authentication

**Union-Based Injection**:
```
User ID: 1' UNION SELECT id, username, email, 'admin', bio, created_at FROM users--
```
Expected: Should extract data from users table

**Authentication Bypass**:
```
User ID: admin' --
```
Expected: Should return admin user data

**Verify Educational Message**:
- Should display educational message explaining the vulnerability
- Should show "How AWS Security Agent Detects It" section
- Should include sample payloads

### 5. Test XSS Vulnerabilities

**Comments Page** (`/pages/comments.html`):

**Stored XSS**:
1. Submit a comment with XSS payload:
```html
<script>alert('XSS')</script>
```
2. Refresh the page
3. Expected: Script should execute (alert box appears)

**More Payloads to Test**:
```html
<img src=x onerror=alert('XSS')>
<svg onload=alert('XSS')>
<iframe src="javascript:alert('XSS')">
```

**Advanced XSS Page** (`/pages/xss-advanced.html`):

**DOM-Based XSS**:
1. Enter payload in the DOM manipulation demo
2. Expected: Script executes via DOM manipulation

**Attribute-Based XSS**:
1. Test attribute injection payloads
2. Expected: Script executes through HTML attributes

**Verify Educational Messages**:
- Should explain different XSS types
- Should show detection methods
- Should include sample payloads

### 6. Test Command Injection Vulnerability

**Tools Page** (`/pages/tools.html`):

**Basic Ping**:
```
Host: 127.0.0.1
```
Expected: Should show ping output

**Command Injection Payloads**:
```
Host: 127.0.0.1; ls -la
Host: 127.0.0.1 && whoami
Host: 127.0.0.1 | cat /etc/passwd
Host: 127.0.0.1; echo "Injected"
```
Expected: Should execute additional commands

**Verify Educational Message**:
- Should display when injection is detected
- Should explain command injection risks
- Should show AWS Security Agent detection methods

### 7. Test Error Handling

**SQL Errors**:
1. Try malformed SQL injection:
```
User ID: 1' AND invalid_column='test
```
Expected: Should display database error message (intentionally exposed)

**Command Errors**:
1. Try invalid command:
```
Host: invalid_host_that_does_not_exist
```
Expected: Should display command error output

### 8. Test CORS

Open browser developer console and test API calls:

```javascript
fetch('https://your-cloudfront-domain.cloudfront.net/api/health')
  .then(r => r.json())
  .then(console.log)
```

Expected: Should work without CORS errors

### 9. Test Session Management

**Logout**:
1. Click "Logout" button on dashboard
2. Should redirect to login page
3. Try accessing dashboard directly
4. Should redirect back to login

**Session Persistence**:
1. Login
2. Close browser tab
3. Reopen application
4. Should still be logged in (session persists)

## Testing with AWS Security Agent

Once deployed, test with AWS Security Agent:

### 1. Configure AWS Security Agent

Point the agent at your CloudFront URL:

```bash
aws-security-agent scan https://your-cloudfront-domain.cloudfront.net
```

### 2. Expected Findings

The agent should detect:

**SQL Injection**:
- Location: `/api/profile/:userId`
- Severity: Critical
- Description: Unsanitized SQL query construction

**Command Injection**:
- Location: `/api/tools/ping`
- Severity: Critical
- Description: Unsanitized system command execution

**Cross-Site Scripting (XSS)**:
- Location: `/api/comments` (stored)
- Location: `/api/search` (reflected)
- Location: Client-side JavaScript (DOM-based)
- Severity: High
- Description: Unsanitized user input rendering

### 3. Verify Educational Messages

For each vulnerability found:
1. Exploit the vulnerability manually
2. Verify educational message appears
3. Compare agent findings with educational content
4. Confirm detection methods match

## Performance Testing

### Load Testing

Test application under load:

```bash
# Install Apache Bench
apt-get install apache2-utils

# Test health endpoint
ab -n 1000 -c 10 https://your-cloudfront-domain.cloudfront.net/api/health

# Test profile endpoint
ab -n 100 -c 5 https://your-cloudfront-domain.cloudfront.net/api/profile/1
```

Expected:
- Health endpoint: >100 requests/second
- Profile endpoint: >50 requests/second
- No errors under normal load

### Stress Testing

Test with higher concurrency:

```bash
ab -n 5000 -c 50 https://your-cloudfront-domain.cloudfront.net/api/health
```

Monitor:
- ECS task CPU/memory usage
- RDS connections
- ALB response times

## Security Testing

### Penetration Testing

Use common security tools:

**SQLMap** (SQL Injection):
```bash
sqlmap -u "https://your-cloudfront-domain.cloudfront.net/api/profile/1" --batch
```

**XSSer** (XSS):
```bash
xsser -u "https://your-cloudfront-domain.cloudfront.net/api/search?q=test"
```

**Burp Suite**:
1. Configure browser to use Burp proxy
2. Navigate through application
3. Use Burp Scanner to detect vulnerabilities
4. Verify findings match expected vulnerabilities

### Expected Results

All security tools should detect the intentional vulnerabilities:
- SQL Injection in profile endpoint
- Command Injection in ping tool
- XSS in comments and search
- Lack of input validation
- Exposed error messages

## Troubleshooting Tests

### Health Check Fails

**Symptoms**: `/api/health` returns unhealthy status

**Check**:
1. ECS task is running: `aws ecs list-tasks --cluster vulnerable-demo-cluster`
2. Database is accessible: Check RDS instance status
3. Security groups allow traffic
4. Backend logs: `aws logs tail /ecs/vulnerable-demo-app --follow`

### Authentication Fails

**Symptoms**: Cannot login with valid credentials

**Check**:
1. Cognito User Pool exists
2. User passwords are set
3. Frontend config.js has correct User Pool ID
4. JWT verification is working in backend

### Vulnerabilities Don't Work

**Symptoms**: Exploits don't work as expected

**Check**:
1. Backend is deployed with latest code
2. Database has seed data
3. No WAF or security controls blocking requests
4. Check backend logs for errors

### Frontend Not Loading

**Symptoms**: CloudFront returns errors

**Check**:
1. S3 bucket has files: `aws s3 ls s3://your-bucket-name`
2. CloudFront distribution is deployed
3. Origin access identity is configured
4. Browser cache (try incognito mode)

## Continuous Testing

### Automated Testing

Set up automated tests to run regularly:

```bash
# Add to cron or CI/CD pipeline
0 */6 * * * /path/to/validate-deployment.sh
```

### Monitoring

Monitor application health:

```bash
# Check health endpoint
watch -n 30 'curl -s https://your-cloudfront-domain.cloudfront.net/api/health | jq'
```

### Alerting

Set up CloudWatch alarms for:
- ECS task health
- RDS connectivity
- ALB 5xx errors
- High response times

## Test Checklist

Use this checklist to verify complete testing:

- [ ] Application accessible via CloudFront
- [ ] Login works with valid credentials
- [ ] Login fails with invalid credentials
- [ ] Dashboard shows healthy infrastructure
- [ ] SQL injection exploits work
- [ ] SQL injection educational messages display
- [ ] Stored XSS works
- [ ] Reflected XSS works
- [ ] DOM-based XSS works
- [ ] Attribute-based XSS works
- [ ] XSS educational messages display
- [ ] Command injection works
- [ ] Command injection educational messages display
- [ ] All frontend pages load
- [ ] All API endpoints respond
- [ ] CORS is configured correctly
- [ ] Session management works
- [ ] Logout works
- [ ] AWS Security Agent detects all vulnerabilities
- [ ] Educational content matches agent findings

## Reporting Issues

If tests fail:

1. Check DEPLOYMENT.md for troubleshooting
2. Review CloudWatch logs
3. Verify all deployment steps completed
4. Check AWS Console for resource status
5. Review backend and frontend configurations

For persistent issues, check:
- Infrastructure stack status
- ECS task definitions
- Security group rules
- IAM permissions
- Database connectivity
