import { CfnOutput, StackProps } from "aws-cdk-lib";
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import {
    AllowedMethods,
    CachePolicy,
    Distribution,
    Function as CloudFrontFunction,
    FunctionCode,
    FunctionEventType,
    OriginRequestPolicy,
    SecurityPolicyProtocol,
    ResponseHeadersPolicy,
    SSLMethod,
    ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin, S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { ComputeType, LinuxArmBuildImage } from "aws-cdk-lib/aws-codebuild";
import { Bucket, ObjectOwnership } from "aws-cdk-lib/aws-s3";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { CfnWebACL } from "aws-cdk-lib/aws-wafv2";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import * as path from "path";
import { CommonBucket } from "../../common/constructs/s3";
import { CommonStack } from "../../common/constructs/stack";
import { StaticWebsiteBuild } from "../../common/constructs/static-website";

// Replace these with your own domain configuration
const CUSTOM_DOMAIN = "YOUR_CUSTOM_DOMAIN"; // e.g. "app.example.com"
const HOSTED_ZONE_ID = "YOUR_HOSTED_ZONE_ID"; // e.g. "Z0123456789ABCDEFGHIJ"
const HOSTED_ZONE_NAME = "YOUR_HOSTED_ZONE_NAME"; // e.g. "example.com"

export class Frontend extends CommonStack {
    public readonly websiteBucket: Bucket;
    public readonly distribution: Distribution;
    public readonly securityHeadersPolicy: ResponseHeadersPolicy;
    public readonly urls: string[];

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const loggingBucket = new CommonBucket(this, "loggingBucket", {
            objectOwnership: ObjectOwnership.OBJECT_WRITER,
        });

        // Grant CloudFront log delivery permissions
        loggingBucket.addToResourcePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                principals: [new ServicePrincipal("cloudfront.amazonaws.com")],
                actions: ["s3:PutObject"],
                resources: [`${loggingBucket.bucketArn}/distribution*`],
                conditions: {
                    StringEquals: {
                        "aws:SourceAccount": this.account,
                    },
                },
            }),
        );

        const websiteBucket = new CommonBucket(this, "websiteBucket", {
            serverAccessLogsBucket: loggingBucket,
        });

        // CloudFront WAF — must be CLOUDFRONT scope (us-east-1 only).
        // Priority 0: allow AWS Security Agent traffic before Bot Control can block it.
        // The Security Agent sends User-Agent: securityagent per AWS docs.
        const cloudfrontWebAcl = new CfnWebACL(this, "cloudfrontWebAcl", {
            defaultAction: { allow: {} },
            scope: "CLOUDFRONT",
            visibilityConfig: {
                metricName: "cloudfrontWebAcl",
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
            },
            rules: [
                // Priority 0: allowlist AWS Security Agent before any managed rules run
                {
                    name: "AllowSecurityAgentPentest",
                    priority: 0,
                    action: { allow: {} },
                    statement: {
                        byteMatchStatement: {
                            fieldToMatch: { singleHeader: { name: "user-agent" } },
                            positionalConstraint: "CONTAINS",
                            searchString: "securityagent",
                            textTransformations: [{ priority: 0, type: "LOWERCASE" }],
                        },
                    },
                    visibilityConfig: {
                        metricName: "AllowSecurityAgentPentest",
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                    },
                },
                {
                    name: "AWSManagedRulesCommonRuleSet",
                    priority: 1,
                    overrideAction: { none: {} },
                    statement: {
                        managedRuleGroupStatement: { vendorName: "AWS", name: "AWSManagedRulesCommonRuleSet" },
                    },
                    visibilityConfig: {
                        metricName: "AWSManagedRulesCommonRuleSet",
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                    },
                },
                {
                    name: "AWSManagedRulesAmazonIpReputationList",
                    priority: 2,
                    overrideAction: { none: {} },
                    statement: {
                        managedRuleGroupStatement: { vendorName: "AWS", name: "AWSManagedRulesAmazonIpReputationList" },
                    },
                    visibilityConfig: {
                        metricName: "AWSManagedRulesAmazonIpReputationList",
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                    },
                },
                {
                    name: "AWSManagedRulesBotControlRuleSet",
                    priority: 3,
                    overrideAction: { none: {} },
                    statement: {
                        managedRuleGroupStatement: { vendorName: "AWS", name: "AWSManagedRulesBotControlRuleSet" },
                    },
                    visibilityConfig: {
                        metricName: "AWSManagedRulesBotControlRuleSet",
                        sampledRequestsEnabled: true,
                        cloudWatchMetricsEnabled: true,
                    },
                },
            ],
        });

        const s3Origin = S3BucketOrigin.withOriginAccessControl(websiteBucket);

        // Custom domain: use the hosted zone directly by ID (no lookup needed)
        const hostedZone = HostedZone.fromHostedZoneAttributes(this, "hostedZone", {
            hostedZoneId: HOSTED_ZONE_ID,
            zoneName: HOSTED_ZONE_NAME,
        });

        const certificate = new Certificate(this, "certificate", {
            domainName: CUSTOM_DOMAIN,
            validation: CertificateValidation.fromDns(hostedZone),
        });

        // Create a Response Headers Policy with security headers
        // This addresses the missing security headers finding from testssl.sh scan
        const securityHeadersPolicy = new ResponseHeadersPolicy(this, "securityHeadersPolicy", {
            responseHeadersPolicyName: "SecurityHeaders",
            comment: "Security headers to protect against common web vulnerabilities",
            securityHeadersBehavior: {
                contentSecurityPolicy: {
                    contentSecurityPolicy: [
                        "default-src 'self'",
                        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                        "style-src 'self' 'unsafe-inline'",
                        "img-src 'self' data: https:",
                        "font-src 'self' data:",
                        "connect-src 'self'",
                        "frame-ancestors 'none'",
                        "base-uri 'self'",
                        "form-action 'self'",
                    ].join("; "),
                    override: true,
                },
                contentTypeOptions: {
                    override: true,
                },
                frameOptions: {
                    frameOption: "DENY",
                    override: true,
                },
                referrerPolicy: {
                    referrerPolicy: "strict-origin-when-cross-origin",
                    override: true,
                },
                strictTransportSecurity: {
                    accessControlMaxAge: { seconds: 31536000 },
                    includeSubdomains: true,
                    preload: true,
                    override: true,
                },
                xssProtection: {
                    protection: true,
                    modeBlock: true,
                    override: true,
                },
            },
        });

        NagSuppressions.addResourceSuppressions(securityHeadersPolicy, [
            {
                id: "AwsSolutions-CFR2",
                reason: "WAF is already configured at the distribution level.",
            },
        ]);

        const distribution = new Distribution(this, "distribution", {
            defaultRootObject: "index.html",
            domainNames: [CUSTOM_DOMAIN],
            certificate,
            defaultBehavior: {
                origin: s3Origin,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: AllowedMethods.ALLOW_ALL,
                originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
                responseHeadersPolicy: securityHeadersPolicy,
            },
            additionalBehaviors: {
                "/assets/*": {
                    origin: s3Origin,
                    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                    originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
                    responseHeadersPolicy: securityHeadersPolicy,
                },
            },
            errorResponses: [
                {
                    httpStatus: 404,
                    responsePagePath: "/index.html",
                    responseHttpStatus: 200,
                },
                {
                    httpStatus: 403,
                    responsePagePath: "/index.html",
                    responseHttpStatus: 200,
                },
            ],
            minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
            sslSupportMethod: SSLMethod.SNI,
            webAclId: cloudfrontWebAcl.attrArn,
            logBucket: loggingBucket,
            logIncludesCookies: true,
            logFilePrefix: "distribution",
        });
        NagSuppressions.addResourceSuppressions(distribution, [
            {
                id: "AwsSolutions-CFR1",
                reason: "Distribution should be globally accessible.",
            },
            {
                id: "AwsSolutions-CFR4",
                reason: "Distribution is configured with TLS_V1_2_2021.",
            },
        ]);

        // Route 53 alias record: custom domain -> CloudFront
        new ARecord(this, "dnsAliasRecord", {
            zone: hostedZone,
            recordName: CUSTOM_DOMAIN,
            target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
        });

        new CfnOutput(this, "url", {
            value: distribution.distributionDomainName,
            description: "CloudFront URL",
        });

        new CfnOutput(this, "customDomainUrl", {
            value: `https://${CUSTOM_DOMAIN}`,
            description: "Custom Domain URL",
        });

        this.websiteBucket = websiteBucket;
        this.distribution = distribution;
        this.securityHeadersPolicy = securityHeadersPolicy;
        this.urls = [
            `https://${CUSTOM_DOMAIN}`,
            `https://${distribution.distributionDomainName}`,
            "http://localhost:3000",
        ];
    }

    /**
     * Add an API Gateway proxy behavior to the CloudFront distribution.
     * Routes /api/* requests to the API Gateway, stripping the /api prefix.
     * This allows the pen test scanner to reach backend endpoints through the
     * same verified domain as the frontend.
     */
    public addApiProxy(apiGatewayDomain: string) {
        // CloudFront Function to rewrite /api/* -> /prod/*
        const rewriteFunction = new CloudFrontFunction(this, "apiRewriteFunction", {
            code: FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  request.uri = request.uri.replace(/^\\/api/, '/prod');
  return request;
}
            `),
        });

        this.distribution.addBehavior("/api/*", new HttpOrigin(apiGatewayDomain), {
            viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: AllowedMethods.ALLOW_ALL,
            responseHeadersPolicy: this.securityHeadersPolicy,
            cachePolicy: CachePolicy.CACHING_DISABLED,
            originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
            functionAssociations: [{
                function: rewriteFunction,
                eventType: FunctionEventType.VIEWER_REQUEST,
            }],
        });

        NagSuppressions.addResourceSuppressions(rewriteFunction, [
            {
                id: "AwsSolutions-CFR3",
                reason: "CloudFront Function for API path rewriting does not require logging.",
            },
        ], true);
    }
}

interface FrontendDeploymentProps extends StackProps {
    websiteBucket: Bucket;
    distribution: Distribution;
    environmentVariables: Record<string, string>;
}

export class FrontendDeployment extends CommonStack {
    constructor(scope: Construct, id: string, props: FrontendDeploymentProps) {
        super(scope, id, props);

        const { websiteBucket, distribution, environmentVariables } = props;

        new StaticWebsiteBuild(this, "staticWebsiteBuild", {
            path: path.join(__dirname, "app"),
            exclude: ["node_modules", "dist"],
            destinationBucket: websiteBucket,
            distribution,
            buildImage: LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
            computeType: ComputeType.SMALL,
            environmentVariables,
            runtimeVersions: {
                nodejs: "22",
            },
            installCommands: ["npm install"],
            commands: ["npm run build"],
            primaryOutputDirectory: "dist",
        });

        new CfnOutput(this, "environmentVariables", {
            value: JSON.stringify(environmentVariables),
        });
    }
}
