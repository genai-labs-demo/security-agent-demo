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

        // DEMO ENVIRONMENT ONLY: CodeBuild project uses simplified configuration
        // For production, consider enabling KMS encryption for build artifacts
        NagSuppressions.addResourceSuppressions(this.project, [
            { id: "AwsSolutions-CB4", 
              reason: "[DEMO ONLY] KMS encryption disabled for CodeBuild to reduce complexity. Production should enable KMS encryption for build artifacts." },
            { id: "AwsSolutions-IAM5", 
              reason: "Wildcard permissions required for S3 sync (s3:PutObject/*) and CloudFront invalidation. This is necessary for website deployment. Acceptable for both demo and production." },
        ], true);

        const triggerCode =
            'const{CodeBuildClient,StartBuildCommand,BatchGetBuildsCommand}=require("@aws-sdk/client-codebuild");' +
            "const cb=new CodeBuildClient();const sleep=ms=>new Promise(r=>setTimeout(r,ms));" +
            "exports.handler=async event=>{const pn=event.ResourceProperties.ProjectName;" +
            'if(event.RequestType==="Delete")return{PhysicalResourceId:event.PhysicalResourceId};' +
            "const{build}=await cb.send(new StartBuildCommand({projectName:pn}));" +
            'console.log("Started:",build.id);' +
            "for(let i=0;i<90;i++){await sleep(10000);" +
            "const r=await cb.send(new BatchGetBuildsCommand({ids:[build.id]}));" +
            'const s=r.builds[0].buildStatus;console.log("Status:",s);' +
            'if(s==="SUCCEEDED")return{PhysicalResourceId:build.id};' +
            'if(["FAILED","FAULT","STOPPED","TIMED_OUT"].includes(s))throw new Error("CodeBuild "+s+": "+build.id);}' +
            'throw new Error("Build timed out");};';

        const triggerFunction = new Function(this, "triggerFunction", {
            runtime: Runtime.NODEJS_22_X,
            handler: "index.handler",
            code: Code.fromInline(triggerCode),
            timeout: Duration.minutes(15),
            memorySize: 128,
        });

        triggerFunction.addToRolePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["codebuild:StartBuild", "codebuild:BatchGetBuilds"],
            resources: [this.project.projectArn],
        }));

        NagSuppressions.addResourceSuppressions(triggerFunction, [
        // Lambda trigger function uses standard AWS patterns for custom resources
            { id: "AwsSolutions-IAM4", reason: "Lambda basic execution role required for logging." },
            { id: "AwsSolutions-IAM4", 
              reason: "Lambda uses AWS managed policy (AWSLambdaBasicExecutionRole) for CloudWatch logging. Standard AWS pattern, acceptable for both demo and production." },
            { id: "AwsSolutions-L1", 
              reason: "Using Node.js 22 (NODEJS_22_X), the latest Lambda runtime available. This is current and acceptable." },

        const provider = new Provider(this, "provider", { onEventHandler: triggerFunction });

        NagSuppressions.addResourceSuppressions(provider, [
        // CDK Provider framework uses managed policies - this is required by the framework
            { id: "AwsSolutions-IAM4", reason: "Provider framework requires managed policies." },
            { id: "AwsSolutions-IAM4", reason: "CDK Provider framework requires AWS managed policies for Lambda execution. This is a framework requirement." },
            { id: "AwsSolutions-IAM5", reason: "CDK Provider framework requires wildcard permissions for CloudWatch Logs. This is a framework requirement." },
            { id: "AwsSolutions-L1", reason: "CDK Provider framework manages its own Lambda runtime version. This is controlled by the CDK version." },

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
