import { CloudfrontWebAcl } from "@aws/pdk/static-website";
import { Aspects, CfnOutput, StackProps } from "aws-cdk-lib";
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import {
    AllowedMethods,
    Distribution,
    OriginRequestPolicy,
    SecurityPolicyProtocol,
    SSLMethod,
    ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { ComputeType, LinuxArmBuildImage } from "aws-cdk-lib/aws-codebuild";
import { Bucket, ObjectOwnership } from "aws-cdk-lib/aws-s3";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import * as path from "path";
import { FunctionRuntimeAspect } from "../../common/aspects";
import { CommonBucket } from "../../common/constructs/s3";
import { CommonStack } from "../../common/constructs/stack";
import { StaticWebsiteBuild } from "../../common/constructs/static-website";
import { S3EncryptionKey } from "../../common/constructs/kms";

const CUSTOM_DOMAIN = "secagentdemo.jossai.people.aws.dev";
const HOSTED_ZONE_ID = "Z00429881ZY3EVX6D1409";
const HOSTED_ZONE_NAME = "jossai.people.aws.dev";

export class Frontend extends CommonStack {
    public readonly websiteBucket: Bucket;
    public readonly distribution: Distribution;
    public readonly urls: string[];

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Create KMS key for S3 bucket encryption
        const s3EncryptionKey = new S3EncryptionKey(
            this,
            "s3EncryptionKey",
            "KMS key for frontend S3 bucket encryption"
        );

        const loggingBucket = new CommonBucket(this, "loggingBucket", {
            objectOwnership: ObjectOwnership.OBJECT_WRITER,
            encryptionKey: s3EncryptionKey,
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
            encryptionKey: s3EncryptionKey,
        });

        const cloudfrontWebAcl = new CloudfrontWebAcl(this, "cloudfrontWebAcl", {
            managedRules: [
                {
                    vendor: "AWS",
                    name: "AWSManagedRulesCommonRuleSet",
                },
                {
                    vendor: "AWS",
                    name: "AWSManagedRulesAmazonIpReputationList",
                },
                {
                    vendor: "AWS",
                    name: "AWSManagedRulesBotControlRuleSet",
                },
            ],
        });
        Aspects.of(cloudfrontWebAcl).add(new FunctionRuntimeAspect());

        const s3Origin = S3BucketOrigin.withOriginAccessControl(websiteBucket);

        // Grant KMS key access to CloudFront service principal for OAC
        s3EncryptionKey.grantDecrypt(new ServicePrincipal("cloudfront.amazonaws.com"));

        // Grant KMS key access to CodeBuild for deployment
        s3EncryptionKey.grantEncryptDecrypt(new ServicePrincipal("codebuild.amazonaws.com"));

        // Custom domain: use the hosted zone directly by ID (no lookup needed)
        const hostedZone = HostedZone.fromHostedZoneAttributes(this, "hostedZone", {
            hostedZoneId: HOSTED_ZONE_ID,
            zoneName: HOSTED_ZONE_NAME,
        });

        const certificate = new Certificate(this, "certificate", {
            domainName: CUSTOM_DOMAIN,
            validation: CertificateValidation.fromDns(hostedZone),
        });

        const distribution = new Distribution(this, "distribution", {
            defaultRootObject: "index.html",
            domainNames: [CUSTOM_DOMAIN],
            certificate,
            defaultBehavior: {
                origin: s3Origin,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: AllowedMethods.ALLOW_ALL,
                originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
            },
            additionalBehaviors: {
                "/assets/*": {
                    origin: s3Origin,
                    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                    originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
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
            webAclId: cloudfrontWebAcl.webAclArn,
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

        // Route 53 alias record: secagentdemo.jossai.people.aws.dev -> CloudFront
        new ARecord(this, "aliasRecord", {
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
        this.urls = [
            `https://${CUSTOM_DOMAIN}`,
            `https://${distribution.distributionDomainName}`,
            "http://localhost:3000",
        ];
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
