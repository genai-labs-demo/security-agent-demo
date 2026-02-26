import * as path from "path";
import { CustomResource, Duration, Stack } from "aws-cdk-lib";
import { Distribution } from "aws-cdk-lib/aws-cloudfront";
import {
    BuildEnvironmentVariableType,
    BuildSpec,
    ComputeType,
    IBuildImage,
    Project,
    Source,
} from "aws-cdk-lib/aws-codebuild";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { Asset } from "aws-cdk-lib/aws-s3-assets";
import { Provider } from "aws-cdk-lib/custom-resources";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

export interface StaticWebsiteBuildProps {
    readonly path: string;
    readonly exclude?: string[];
    readonly destinationBucket: IBucket;
    readonly distribution: Distribution;
    readonly buildImage?: IBuildImage;
    readonly computeType?: ComputeType;
    readonly environmentVariables?: Record<string, string>;
    readonly runtimeVersions?: Record<string, string>;
    readonly installCommands?: string[];
    readonly commands?: string[];
    readonly primaryOutputDirectory?: string;
}

export class StaticWebsiteBuild extends Construct {
    public readonly project: Project;

    constructor(scope: Construct, id: string, props: StaticWebsiteBuildProps) {
        super(scope, id);

        const {
            path: sourcePath,
            exclude = [],
            destinationBucket,
            distribution,
            buildImage,
            computeType,
            environmentVariables = {},
            runtimeVersions = {},
            installCommands = [],
            commands = [],
            primaryOutputDirectory = "dist",
        } = props;

        const sourceAsset = new Asset(this, "sourceAsset", {
            path: sourcePath,
            exclude: [...exclude, primaryOutputDirectory],
        });

        const buildEnvironmentVariables: Record<string, any> = {};
        for (const [key, value] of Object.entries(environmentVariables)) {
            buildEnvironmentVariables[key] = {
                type: BuildEnvironmentVariableType.PLAINTEXT,
                value,
            };
        }

        this.project = new Project(this, "buildProject", {
            source: Source.s3({
                bucket: sourceAsset.bucket,
                path: sourceAsset.s3ObjectKey,
            }),
            buildSpec: BuildSpec.fromObject({
                version: "0.2",
                phases: {
                    install: {
                        "runtime-versions": runtimeVersions,
                        commands: installCommands,
                    },
                    build: { commands },
                    post_build: {
                        commands: [
                            `aws s3 sync ${primaryOutputDirectory}/ s3://${destinationBucket.bucketName}/ --delete`,
                            `aws cloudfront create-invalidation --distribution-id ${distribution.distributionId} --paths "/*"`,
                        ],
                    },
                },
            }),
            environment: { buildImage, computeType, environmentVariables: buildEnvironmentVariables },
        });

        destinationBucket.grantReadWrite(this.project);
        sourceAsset.bucket.grantRead(this.project);
        this.project.addToRolePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["cloudfront:CreateInvalidation"],
            resources: [`arn:aws:cloudfront::${Stack.of(this).account}:distribution/${distribution.distributionId}`],
        }));

        NagSuppressions.addResourceSuppressions(this.project, [
            { id: "AwsSolutions-CB4", reason: "KMS encryption not required for demo environment" },
            { id: "AwsSolutions-IAM5", reason: "Wildcard permissions required for S3 sync and CloudFront invalidation" },
        ], true);

        // Lambda code is now in a separate file for better auditability and security scanning
        const triggerCodePath = path.join(__dirname, "static-website-trigger");

        const triggerFunction = new Function(this, "triggerFunction", {
            runtime: Runtime.NODEJS_22_X,
            handler: "index.handler",
            code: Code.fromAsset(triggerCodePath),
            timeout: Duration.minutes(15),
            memorySize: 128,
        });

        triggerFunction.addToRolePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["codebuild:StartBuild", "codebuild:BatchGetBuilds"],
            resources: [this.project.projectArn],
        }));

        NagSuppressions.addResourceSuppressions(triggerFunction, [
            { id: "AwsSolutions-IAM4", reason: "Lambda basic execution role required for logging." },
            { id: "AwsSolutions-L1", reason: "Using Node.js 22, the latest supported runtime." },
        ], true);

        const provider = new Provider(this, "provider", { onEventHandler: triggerFunction });

        NagSuppressions.addResourceSuppressions(provider, [
            { id: "AwsSolutions-IAM4", reason: "Provider framework requires managed policies." },
            { id: "AwsSolutions-IAM5", reason: "Provider framework requires wildcard log permissions." },
            { id: "AwsSolutions-L1", reason: "Provider framework manages its own runtime." },
        ], true);

        new CustomResource(this, "buildTrigger", {
            serviceToken: provider.serviceToken,
            properties: {
                ProjectName: this.project.projectName,
                SourceHash: sourceAsset.assetHash,
                EnvHash: JSON.stringify(environmentVariables),
            },
        });
    }
}
