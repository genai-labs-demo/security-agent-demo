import { StackProps, Stage } from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { CommonStack } from "../../common/constructs/stack";
import { Auth } from "./constructs/auth";
import { Database } from "./database";
import { Networking } from "./networking";
import { RestApi } from "./rest-api";
import { Storage } from "./storage";

interface BackendProps extends StackProps {
    urls: string[];
}

export class Backend extends CommonStack {
    public readonly environmentVariables: Record<string, string>;

    constructor(scope: Construct, id: string, props: BackendProps) {
        super(scope, id, props);

        const { urls } = props;

        const networking = new Networking(this, "networking");

        const auth = new Auth(this, "auth", {
            urls,
        });

        const storage = new Storage(this, "storage", {
            urls,
        });
        
        // Implement object-level authorization with user-specific path restrictions
        // This prevents authenticated users from accessing each other's private files
        // Users can only access objects under their own Cognito Identity ID prefix
        
        // Grant full access (read/write/delete) to user-specific private folder
        auth.identityPool.authenticatedRole.addToPrincipalPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "s3:PutObject",
                    "s3:GetObject",
                    "s3:DeleteObject",
                ],
                resources: [
                    // Users can only access objects under their own user-specific prefix
                    // ${cognito-identity.amazonaws.com:sub} is replaced by AWS with the user's Identity ID at runtime
                    `${storage.storageBucket.bucketArn}/private/\${cognito-identity.amazonaws.com:sub}/*`,
                ],
            })
        );

        // Grant read-only access to shared/public resources (CRM assets)
        auth.identityPool.authenticatedRole.addToPrincipalPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["s3:GetObject"],
                resources: [
                    // Read-only access to shared CRM assets
                    `${storage.storageBucket.bucketArn}/logos/*`,
                    `${storage.storageBucket.bucketArn}/avatars/*`,
                    `${storage.storageBucket.bucketArn}/icons/*`,
                ],
            })
        );

        // Grant list access with path restrictions
        auth.identityPool.authenticatedRole.addToPrincipalPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ["s3:ListBucket"],
                resources: [storage.storageBucket.bucketArn],
                conditions: {
                    StringLike: {
                        "s3:prefix": ["private/\${cognito-identity.amazonaws.com:sub}/*", "logos/*", "avatars/*", "icons/*"],
                    },
                },
            })
        );

        // CRM Database
        const database = new Database(this, "database", {
            vpc: networking.vpc,
            securityGroup: networking.securityGroup,
            imagesBucket: storage.storageBucket,
        });

        const restApi = new RestApi(this, "restApi", {
            urls,
            userPool: auth.userPool,
            regionalWebAclArn: auth.regionalWebAclArn,
            vpc: networking.vpc,
            securityGroup: networking.securityGroup,
            databaseProxyEndpoint: database.proxyEndpoint,
            databaseName: database.databaseName,
            databaseSecret: database.databaseSecret,
            crmImagesBucket: storage.storageBucket,
        });
        NagSuppressions.addStackSuppressions(this, [
            {
                id: "AwsSolutions-IAM4",
                reason: "Lambda functions require managed policies to interface with the vpc.",
            },
            {
                id: "AwsSolutions-SMG4",
                reason: "Secret rotation temporarily disabled — hosted rotation nested stack fails due to Lambda function name length exceeding 64 chars.",
            },
        ]);

        // Suppress IAM5 for CDK-generated default policies that use wildcard
        // object-level permissions scoped to specific resource ARNs.
        // These do NOT affect the intentional security demo vulnerabilities
        // (IDOR, SQLi, XSS, Command Injection) which live in application code.
        const iam5Suppression = [
            {
                id: "AwsSolutions-IAM5",
                reason: "CDK high-level constructs (grantRead, grantReadWrite, Provider framework) generate scoped wildcard permissions on specific resource ARNs.",
            },
        ];
        NagSuppressions.addResourceSuppressions(
            auth.identityPool.authenticatedRole, iam5Suppression, true
        );
        NagSuppressions.addResourceSuppressions(
            database.node.findChild("seedProvider"), iam5Suppression, true
        );
        NagSuppressions.addResourceSuppressions(
            restApi.node.findChild("proxyFunction"), iam5Suppression, true
        );
        const bucketDeployment = this.node.tryFindChild(
            "Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C"
        );
        if (bucketDeployment) {
            NagSuppressions.addResourceSuppressions(
                bucketDeployment, iam5Suppression, true
            );
        }

        this.environmentVariables = {
            VITE_REGION: this.region!,
            VITE_STAGE: Stage.of(this)?.stageName || "unknown",
            VITE_BUILD_TIMESTAMP: new Date().toISOString(),
            VITE_BUILD_VERSION: process.env.npm_package_version || "0.0.0",
            VITE_CALLBACK_URL: urls[0],
            ...(urls[1] && { VITE_CLOUDFRONT_URL: urls[1] }),
            VITE_USER_POOL_ID: auth.userPool.userPoolId,
            ...(auth.userPoolDomain && {
                VITE_USER_POOL_DOMAIN_URL: auth.userPoolDomain.baseUrl().replace("https://", ""),
            }),
            VITE_USER_POOL_CLIENT_ID: auth.userPoolClient.userPoolClientId,
            VITE_IDENTITY_POOL_ID: auth.identityPool.identityPoolId,
            VITE_REST_API_URL: restApi.restApi.url,
            VITE_STORAGE_BUCKET_NAME: storage.storageBucket.bucketName,
        };
    }
}
