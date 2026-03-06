import { Aspects, Stage, StageProps } from "aws-cdk-lib";
import { AwsSolutionsChecks, NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { Backend } from "./stacks/backend";
import { Frontend, FrontendDeployment } from "./stacks/frontend";

export class ApplicationStage extends Stage {
    constructor(scope: Construct, id: string, props?: StageProps) {
        super(scope, id, props);

        const frontend = new Frontend(this, "frontend");

        const backend = new Backend(this, "backend", {
            urls: frontend.urls,
        });

        // Proxy API requests through CloudFront so the pen test scanner
        // can reach backend endpoints via the verified frontend domain.
        // e.g. https://<your-domain>/api/security-profile/1
        //   -> https://<api-id>.execute-api.<region>.amazonaws.com/prod/security-profile/1
        // Note: domain is hardcoded to avoid a circular stack dependency
        // (frontend needs backend.restApi, backend needs frontend.urls)
        // After first deploy, replace with your API Gateway domain from the CDK output.
        frontend.addApiProxy("YOUR_API_GATEWAY_DOMAIN"); // e.g. "abc123.execute-api.us-east-1.amazonaws.com"

        // this stack must be named frontendDeployment
        new FrontendDeployment(this, "frontendDeployment", {
            websiteBucket: frontend.websiteBucket,
            distribution: frontend.distribution,
            environmentVariables: backend.environmentVariables,
        });

        NagSuppressions.addResourceSuppressions(
            this,
            [
                {
                    id: "AwsSolutions-IAM4",
                    reason: "Lambda functions can require managed policies.",
                    appliesTo: [
                        "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
                        "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole",
                    ],
                },
                {
                    id: "AwsSolutions-IAM5",
                    reason: "CDK high-level constructs generate wildcard permissions for custom resource providers, bucket notifications, and auto-delete handlers.",
                    appliesTo: [
                        "Resource::*",
                    ],
                },
                {
                    id: "AwsSolutions-L1",
                    reason: "CDK custom resource providers and auto-delete handlers manage their own Lambda runtimes.",
                },
            ],
            true
        );
        Aspects.of(this).add(new AwsSolutionsChecks());
    }
}
