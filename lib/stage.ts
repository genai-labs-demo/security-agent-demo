import { Aspects, Stage, StageProps } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
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

        Aspects.of(this).add(new AwsSolutionsChecks());
    }
}
