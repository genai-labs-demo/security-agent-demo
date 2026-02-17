import { config } from 'dotenv';
import {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

// Load environment variables
config();

async function testCognito() {
  console.log('=== Testing Cognito Configuration ===\n');
  
  const userPoolId = process.env.USER_POOL_ID;
  const clientId = process.env.USER_POOL_CLIENT_ID;
  const region = process.env.AWS_REGION;
  
  console.log(`User Pool ID: ${userPoolId}`);
  console.log(`Client ID: ${clientId}`);
  console.log(`Region: ${region}\n`);
  
  try {
    const cognitoClient = new CognitoIdentityProviderClient({ region });
    
    // Test 1: Describe User Pool
    console.log('Test 1: Describing User Pool...');
    const describeCommand = new DescribeUserPoolCommand({
      UserPoolId: userPoolId,
    });
    const poolInfo = await cognitoClient.send(describeCommand);
    console.log(`✓ User Pool Name: ${poolInfo.UserPool?.Name}`);
    console.log(`✓ User Pool Status: ${poolInfo.UserPool?.Status}`);
    console.log(`✓ User Pool Creation Date: ${poolInfo.UserPool?.CreationDate}\n`);
    
    // Test 2: List Users
    console.log('Test 2: Listing Users...');
    const listCommand = new ListUsersCommand({
      UserPoolId: userPoolId,
    });
    const users = await cognitoClient.send(listCommand);
    console.log(`✓ Found ${users.Users?.length || 0} users:`);
    users.Users?.forEach(user => {
      console.log(`  - ${user.Username} (${user.UserStatus})`);
    });
    
    console.log('\n✓ All Cognito tests passed!');
    return true;
  } catch (error) {
    console.error('✗ Cognito test failed:', error);
    return false;
  }
}

testCognito()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
