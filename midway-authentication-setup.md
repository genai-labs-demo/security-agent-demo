# Midway Authentication Setup Guide

This document describes how Midway (Amazon Federate) authentication is integrated into this project using Cognito as the identity broker. Use this as a reference to replicate the pattern in another project.

---

## Architecture Overview

The authentication flow is:

```
User → Login Page → "Login with Midway" button
  → Cognito Hosted UI → Amazon Federate (Midway) OIDC Provider
  → Cognito issues tokens → Amplify stores session
  → API calls use Cognito tokens → API Gateway validates via Cognito Authorizer
```

Cognito acts as the intermediary. Midway is registered as an OIDC Identity Provider on the Cognito User Pool. When a user clicks "Login with Midway," Amplify triggers `signInWithRedirect()`, which sends the user through the Cognito Hosted UI → Midway OIDC flow → back to the app with authorization code → Cognito exchanges it for tokens.

---

## 1. Project Configuration

A central config file controls whether Midway is enabled and stores per-account secret IDs.

**`config/project-config.json`**
```json
{
    "projectId": "your-project-id",
    "midway": true,
    "accounts": {
        "dev": {
            "number": "123456789012",
            "region": "us-east-1",
            "midwaySecretId": "xxxxxx"
        },
        "prod": {
            "number": "987654321098",
            "region": "us-east-1",
            "midwaySecretId": "yyyyyy"
        }
    }
}
```

- `midway: true` enables the entire Midway integration across backend and frontend.
- Each account has a `midwaySecretId` — this is the suffix of an AWS Secrets Manager secret named `{projectId}-midway-secret-{midwaySecretId}`. The secret must contain a JSON key `clientID` with the OIDC client secret from Amazon Federate.

**`config/index.ts`** — TypeScript types:
```typescript
export interface AccountConfig {
    number: string;
    region: string;
    midwaySecretId?: string;  // Only needed when midway is enabled
}
```

---

## 2. Backend — CDK Cognito Setup

### 2a. Cognito User Pool (`LabsUserPool`)

Located in `src/backend/lib/common/constructs/cognito.ts`.

When Midway is enabled, the User Pool gets custom attributes for federated user data:

```typescript
customAttributes: getMidwaySecretId(scope)
    ? {
          posix: new StringAttribute({ mutable: true }),   // POSIX groups from Midway
          ldap: new StringAttribute({ mutable: true }),    // LDAP groups from Midway
      }
    : props.customAttributes,
```

The User Pool domain is set to `{projectId}-{accountId}` as a Cognito-managed domain prefix:
```typescript
this.userPoolDomain = this.addDomain("userPoolDomain", {
    cognitoDomain: {
        domainPrefix: `${projectConfig.projectId}-${Stack.of(scope).account}`,
    },
});
```

MFA is intentionally suppressed when using Midway (Midway handles its own MFA):
```typescript
NagSuppressions.addResourceSuppressions(userPool, [
    {
        id: "AwsSolutions-COG2",
        reason: "Cognito user pool should not require MFA when using Midway.",
    },
]);
```

### 2b. Cognito User Pool Client (`LabsUserPoolClient`)

When Midway is enabled, the client is configured for the authorization code grant flow with OIDC scopes:

```typescript
authFlows: midwaySecretId
    ? { custom: true, userSrp: true }
    : props.authFlows,

oAuth: midwaySecretId
    ? {
          flows: {
              authorizationCodeGrant: true,
              implicitCodeGrant: false,
          },
          scopes: [OAuthScope.OPENID, OAuthScope.PROFILE],
          callbackUrls: props.oAuth?.callbackUrls,
          logoutUrls: props.oAuth?.logoutUrls,
      }
    : props.oAuth,
```

### 2c. OIDC Identity Provider (Amazon Federate)

This is the core of the Midway integration. A `UserPoolIdentityProviderOidc` is created and linked to the User Pool Client:

```typescript
supportedIdentityProviders: midwaySecretId
    ? [
          UserPoolClientIdentityProvider.custom(
              new UserPoolIdentityProviderOidc(scope, "userPoolIdentityProvider", {
                  userPool: props.userPool,
                  name: "AmazonFederate",
                  attributeMapping: {
                      email: ProviderAttribute.other("EMAIL"),
                      custom: {
                          "custom:posix": ProviderAttribute.other("POSIX_GROUPS"),
                      },
                      fullname: ProviderAttribute.other("GECOS"),
                  },
                  clientId: projectConfig.projectId,
                  clientSecret: Secret.fromSecretCompleteArn(
                      scope,
                      "midwaySecret",
                      `arn:aws:secretsmanager:${Stack.of(scope).region}:${Stack.of(scope).account}:secret:${
                          projectConfig.projectId
                      }-midway-secret-${midwaySecretId}`
                  )
                      .secretValueFromJson("clientID")
                      .unsafeUnwrap(),
                  attributeRequestMethod: OidcAttributeRequestMethod.GET,
                  issuerUrl:
                      Stack.of(scope).account ===
                      projectConfig.accounts[PresetStageType.Prod]?.number
                          ? "https://idp.federate.amazon.com"
                          : "https://idp-integ.federate.amazon.com",
              }).providerName
          ),
      ]
    : props.supportedIdentityProviders,
```

Key details:
- Provider name: `"AmazonFederate"`
- Issuer URLs:
  - Production: `https://idp.federate.amazon.com`
  - Dev/Integ: `https://idp-integ.federate.amazon.com`
- Client ID: the `projectId` from config (this must match the OIDC client registered in Amazon Federate)
- Client Secret: pulled from Secrets Manager at `arn:aws:secretsmanager:{region}:{account}:secret:{projectId}-midway-secret-{midwaySecretId}`, JSON key `clientID`
- Attribute mapping:
  - `EMAIL` → `email`
  - `POSIX_GROUPS` → `custom:posix`
  - `GECOS` → `fullname`
- Attribute request method: `GET`

### 2d. Auth Construct (`src/backend/lib/stacks/backend/auth.ts`)

The `Auth` construct wires everything together:
- Creates the `LabsUserPool` with self-sign-up disabled, email required
- Creates `Admin` and `Users` user pool groups
- Creates the `LabsUserPoolClient` with 8-hour token validity (access, ID, refresh)
- Creates a Cognito Identity Pool linked to the User Pool Client
- Creates authenticated/unauthenticated IAM roles (unauthenticated role denies all actions)
- Attaches a WAF WebACL to the User Pool with rate limiting, bot control, and SQL injection rules

### 2e. API Gateway Authorization

In `src/backend/lib/stacks/backend/rest-api/index.ts`, the REST API uses a Cognito authorizer:

```typescript
const restApi = new apigateway.RestApi(this, "eventPlannerApi", {
    defaultMethodOptions: {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: new apigateway.CognitoUserPoolsAuthorizer(this, "authorizer", {
            cognitoUserPools: [userPool],
            identitySource: "method.request.header.Authorization",
        }),
    },
});
```

The frontend sends the Cognito ID token in the `Authorization` header. API Gateway validates it against the User Pool — no custom Lambda authorizer needed.

---

## 3. Frontend — Amplify + React Setup

### 3a. Amplify Configuration (`src/frontend/src/App.tsx`)

Amplify is configured with the Cognito User Pool and OAuth settings:

```typescript
Amplify.configure({
    Auth: {
        Cognito: {
            userPoolId: import.meta.env.VITE_USER_POOL_ID,
            userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
            identityPoolId: import.meta.env.VITE_IDENTITY_POOL_ID,
            allowGuestAccess: false,
            loginWith: {
                oauth: {
                    domain: import.meta.env.VITE_USER_POOL_DOMAIN_URL,
                    scopes: ["openid"],
                    redirectSignIn: [
                        "http://localhost:3000",
                        import.meta.env.VITE_CALLBACK_URL,
                    ],
                    redirectSignOut: [
                        "http://localhost:3000",
                        import.meta.env.VITE_CALLBACK_URL,
                    ],
                    responseType: "code",
                },
            },
        },
    },
});
```

API calls attach the ID token as the Authorization header:
```typescript
const apiConfig = {
    headers: async () => ({
        Authorization: (await fetchAuthSession()).tokens?.idToken?.toString() ?? "",
    }),
};
```

### 3b. Environment Variables

These `VITE_` variables are required for the frontend:

| Variable | Description |
|---|---|
| `VITE_USER_POOL_ID` | Cognito User Pool ID |
| `VITE_USER_POOL_CLIENT_ID` | Cognito User Pool Client ID |
| `VITE_IDENTITY_POOL_ID` | Cognito Identity Pool ID |
| `VITE_USER_POOL_DOMAIN_URL` | Cognito Hosted UI domain (e.g., `{projectId}-{accountId}.auth.{region}.amazoncognito.com`) |
| `VITE_CALLBACK_URL` | The deployed app URL (used for OAuth redirect) |
| `VITE_MIDWAY` | `"true"` or `"false"` — controls whether the Midway login button is shown |

### 3c. Login Page (`src/frontend/src/pages/Login/index.tsx`)

The login page conditionally renders the Midway button based on `VITE_MIDWAY`:

```tsx
{import.meta.env.VITE_MIDWAY === "true" && (
    <Button onClick={() => signInWithRedirect()} variant="primary">
        Login with Midway
    </Button>
)}
```

`signInWithRedirect()` from `aws-amplify/auth` triggers the Cognito Hosted UI OAuth flow, which redirects to the configured OIDC provider (AmazonFederate/Midway).

Below the Midway button, a standard Cognito `<Authenticator>` component is rendered as a fallback for username/password login.

### 3d. Token Extraction (`src/frontend/src/hooks/useAuthToken.ts`)

After authentication, the hook extracts user info from the ID token with fallbacks for both Cognito and Midway claims:

```typescript
const session = await fetchAuthSession();
const idToken = session.tokens?.idToken;
const payload = idToken.payload;

// Email extraction priority:
// 1. payload.email
// 2. payload['cognito:username']
// 3. payload.username
// 4. payload.sub

// Name extraction priority (Midway uses standard OIDC claims):
// 1. payload.name           ← Midway provides this
// 2. payload.given_name     ← Midway provides this
// 3. payload['cognito:name']
// 4. payload['custom:name']

// Detect auth method:
const isFederated = !!payload.identities; // Midway/federated users have this field
```

---

## 4. Prerequisites for Replication

To apply this pattern to another project, you need:

1. **Amazon Federate OIDC Client Registration** — Register your project as an OIDC client with Amazon Federate. You'll receive a client ID and client secret. The client ID should match your `projectId`.

2. **AWS Secrets Manager Secret** — In each AWS account, create a secret named `{projectId}-midway-secret-{secretSuffix}` containing:
   ```json
   {
       "clientID": "your-oidc-client-secret-from-federate"
   }
   ```

3. **Cognito Domain** — The Cognito User Pool needs a domain for the Hosted UI. This project uses a Cognito-managed domain prefix: `{projectId}-{accountId}`.

4. **Callback URLs** — Register your app's URLs (localhost for dev, deployed URL for prod) as allowed callback/logout URLs in both the Cognito User Pool Client and the Amazon Federate OIDC client registration.

5. **Frontend Environment Variables** — Set all the `VITE_` variables listed above, including `VITE_MIDWAY=true`.

---

## 5. Security Considerations

- MFA is handled by Midway itself, so Cognito MFA is disabled for federated users.
- WAF rules are attached to the Cognito User Pool (rate limiting at 3000 req/IP, bot control, SQL injection, known bad inputs, Unix shell command protection).
- The unauthenticated Identity Pool role explicitly denies all actions.
- Token validity is set to 8 hours for access, ID, and refresh tokens.
- Self-sign-up is disabled on the User Pool — users must be created by an admin or come through Midway federation.
- API Gateway uses the Cognito authorizer to validate tokens on every request.
