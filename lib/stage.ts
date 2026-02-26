import { Aspects, Stage, StageProps } from "aws-cdk-lib";
import { AwsSolutionsChecks, NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { Backend } from "./stacks/backend";
import { DnsRoleStack } from "./stacks/dns";
import { Frontend, FrontendDeployment } from "./stacks/frontend";

export class ApplicationStage extends Stage {
    constructor(scope: Construct, id: string, props?: StageProps) {
        super(scope, id, props);

        const frontend = new Frontend(this, "frontend");

        // IAM role for NovaDomainService (people.aws.dev domain management)
        new DnsRoleStack(this, "dns");

        const backend = new Backend(this, "backend", {
            urls: frontend.urls,
        });

        // this stack must be named frontendDeployment
        new FrontendDeployment(this, "frontendDeployment", {
            websiteBucket: frontend.websiteBucket,
            distribution: frontend.distribution,
            environmentVariables: backend.environmentVariables,
        });

        // DEMO ENVIRONMENT ONLY: The following suppressions are for cost and convenience in a
        // security training demo. In production, these should be removed and proper security
        // controls should be implemented instead.
        //
        // WARNING: Do not use these suppressions in production environments.
        NagSuppressions.addResourceSuppressions(
            this,
            [
                {
                    id: "AwsSolutions-IAM4",
                    reason: "[DEMO ONLY] Lambda functions use AWS managed policies (AWSLambdaBasicExecutionRole, AWSLambdaVPCAccessExecutionRole). " +
                            "This is acceptable for Lambda execution roles but should be reviewed for production.",
                    appliesTo: [
                        "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
                        "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole",
                    ],
                },
                {
                    id: "AwsSolutions-IAM5",
                    reason: "[DEMO ONLY] High-level CDK constructs use wildcard permissions for dynamic resource creation. " +
                            "For production, review each wildcard and scope to specific resources where possible.",
                },
                {
                    id: "AwsSolutions-L1",
                    reason: "[DEMO ONLY] Lambda runtimes are managed by high-level constructs. For production, explicitly pin runtime versions.",
                },
            ],
            true
        );
        Aspects.of(this).add(new AwsSolutionsChecks());
    }
}
