import { aws_apigateway as apigateway, aws_iam, Duration, RemovalPolicy } from "aws-cdk-lib";
import {
    AuthorizationType,
    CognitoUserPoolsAuthorizer,
    Cors,
    LambdaIntegration,
    LogGroupLogDestination,
    MethodLoggingLevel,
    RequestValidator,
} from "aws-cdk-lib/aws-apigateway";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { SecurityGroup, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { CfnWebACLAssociation } from "aws-cdk-lib/aws-wafv2";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import * as path from "path";
import { CommonPythonFunction } from "../../../common/blueprints";

interface RestApiProps {
    urls: string[];
    vpc?: Vpc;
    securityGroup?: SecurityGroup;
    userPool: UserPool;
    regionalWebAclArn: string;
    // CRM database resources
    databaseProxyEndpoint?: string;
    databaseName?: string;
    databaseSecret?: Secret;
    crmImagesBucket?: Bucket;
}

export class RestApi extends Construct {
    public readonly restApi: apigateway.LambdaRestApi;

    constructor(scope: Construct, id: string, props: RestApiProps) {
        super(scope, id);

        const { 
            urls, 
            vpc, 
            securityGroup, 
            userPool, 
            regionalWebAclArn,
            databaseProxyEndpoint,
            databaseName,
            databaseSecret,
            crmImagesBucket
        } = props;

        const restApi = new apigateway.RestApi(this, "restApi", {
            defaultMethodOptions: {
                authorizationType: AuthorizationType.COGNITO,
                authorizer: new CognitoUserPoolsAuthorizer(this, "authorizer", {
                    cognitoUserPools: [userPool],
                    identitySource: "method.request.header.Authorization",
                }),
            },
            defaultCorsPreflightOptions: {
                allowCredentials: true,
                allowOrigins: urls,
                allowMethods: Cors.ALL_METHODS,
                allowHeaders: Cors.DEFAULT_HEADERS,
            },
            deployOptions: {
                accessLogDestination: new LogGroupLogDestination(
                    new LogGroup(this, "restApiLogGroup", {
                        removalPolicy: RemovalPolicy.DESTROY,
                        retention: RetentionDays.THREE_MONTHS,
                    })
                ),
                loggingLevel: MethodLoggingLevel.ERROR,
                metricsEnabled: true,
                dataTraceEnabled: false,
            },
            cloudWatchRole: true,
            cloudWatchRoleRemovalPolicy: RemovalPolicy.DESTROY,
        });
        NagSuppressions.addResourceSuppressions(
            restApi,
            [
                {
                    id: "AwsSolutions-IAM4",
                    reason: "RestApi requires the AmazonAPIGatewayPushToCloudWatchLogs policy for logging.",
                },
            ],
            true
        );

        const environment: Record<string, string> = {
            ALLOWED_ORIGINS: JSON.stringify(urls),
        };

        // Add CRM database environment variables if resources are provided
        if (databaseProxyEndpoint) {
            environment.DATABASE_PROXY_ENDPOINT = databaseProxyEndpoint;
        }
        if (databaseName) {
            environment.DATABASE_NAME = databaseName;
        }
        if (databaseSecret) {
            environment.DATABASE_SECRET_ARN = databaseSecret.secretArn;
        }
        if (crmImagesBucket) {
            environment.CRM_IMAGES_BUCKET = crmImagesBucket.bucketName;
        }

        const proxyFunction = new CommonPythonFunction(this, "proxyFunction", {
            entry: path.join(__dirname, "proxy"),
            index: "index.py",
            handler: "lambda_handler",
            environment,
            memorySize: 1024,
            timeout: Duration.minutes(2),
            ...(vpc && {
                vpc,
                vpcSubnets: {
                    subnetType: SubnetType.PRIVATE_WITH_EGRESS,
                },
                securityGroups: [securityGroup!],
            }),
        });

        // Grant permissions for CRM database resources
        if (databaseSecret) {
            databaseSecret.grantRead(proxyFunction);
        }
        if (crmImagesBucket) {
            crmImagesBucket.grantRead(proxyFunction);
        }

        // Grant CloudWatch metrics permissions for database monitoring
        if (databaseProxyEndpoint) {
            proxyFunction.addToRolePolicy(new aws_iam.PolicyStatement({
                effect: aws_iam.Effect.ALLOW,
                actions: ['cloudwatch:PutMetricData'],
                resources: ['*']
            }));
        }

        // Add unauthenticated security demo endpoints BEFORE the catch-all proxy
        // Security demo endpoints - security-profile now requires Cognito authentication to prevent IDOR
        const lambdaInteg = new LambdaIntegration(proxyFunction);
        const noAuth = { authorizationType: AuthorizationType.NONE };

        const secProfile = restApi.root.addResource("security-profile");
        secProfile.addMethod("GET", lambdaInteg);
        secProfile.addMethod("POST", lambdaInteg);
        const secProfileId = secProfile.addResource("{id}");
        secProfileId.addMethod("GET", lambdaInteg);

        const secComments = restApi.root.addResource("security-comments");
        secComments.addMethod("GET", lambdaInteg, noAuth);
        secComments.addMethod("POST", lambdaInteg, noAuth);

        const secSearch = restApi.root.addResource("security-search");
        secSearch.addMethod("GET", lambdaInteg, noAuth);
        secSearch.addMethod("POST", lambdaInteg, noAuth);

        const secTools = restApi.root.addResource("security-tools");
        const secPing = secTools.addResource("ping");
        secPing.addMethod("POST", lambdaInteg, noAuth);
        const secNslookup = secTools.addResource("nslookup");
        secNslookup.addMethod("POST", lambdaInteg, noAuth);

        const secHealth = restApi.root.addResource("security-health");
        secHealth.addMethod("GET", lambdaInteg, noAuth);

        const secXssPage = restApi.root.addResource("security-xss-page");
        secXssPage.addMethod("GET", lambdaInteg, noAuth);

        const secXssComments = restApi.root.addResource("security-xss-comments");
        secXssComments.addMethod("GET", lambdaInteg, noAuth);

        const secXssSearch = restApi.root.addResource("security-xss-search");
        secXssSearch.addMethod("GET", lambdaInteg, noAuth);

        // Suppress cdk-nag authorization warnings for intentionally vulnerable security demo endpoints.
        // These endpoints are deliberately unauthenticated to allow pen test scanners to discover
        // and exploit vulnerabilities (IDOR, SQLi, XSS, Command Injection, Mass Assignment)
        // as part of the AWS Security Agent educational demo.
        const securityDemoNagSuppression = [
            {
                id: "AwsSolutions-APIG4",
                reason: "Security demo endpoints are intentionally unauthenticated to allow pen test scanners to test for vulnerabilities without requiring Cognito JWT tokens.",
            },
            {
                id: "AwsSolutions-COG4",
                reason: "Security demo endpoints are intentionally unauthenticated to allow pen test scanners to test for vulnerabilities without requiring Cognito JWT tokens.",
            },
        ];
        for (const resource of [secComments, secSearch, secTools, secPing, secNslookup, secHealth, secXssPage, secXssComments, secXssSearch]) {
            NagSuppressions.addResourceSuppressions(resource, securityDemoNagSuppression, true);
        }

        // Catch-all proxy for remaining (authenticated) CRM endpoints
        restApi.root.addProxy({
            defaultIntegration: lambdaInteg,
        });

        new RequestValidator(this, "requestValidator", {
            restApi,
            validateRequestBody: true,
            validateRequestParameters: true,
        });

        new CfnWebACLAssociation(this, "restApiWebAclAssociation", {
            resourceArn: restApi.deploymentStage.stageArn,
            webAclArn: regionalWebAclArn,
        });

        this.restApi = restApi;
    }
}
