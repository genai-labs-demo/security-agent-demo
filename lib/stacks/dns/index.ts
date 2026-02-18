import { CfnOutput, StackProps } from "aws-cdk-lib";
import {
    AccountPrincipal,
    Effect,
    ManagedPolicy,
    PolicyStatement,
    Role,
} from "aws-cdk-lib/aws-iam";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { CommonStack } from "../../common/constructs/stack";

/**
 * Creates an IAM role that allows the NovaDomainService (people.aws.dev)
 * to manage Route 53 hosted zones in this account.
 *
 * The NovaDomainService runs in account 791674550530 and needs to assume
 * a role in your account to create/manage hosted zones for *.people.aws.dev domains.
 */
export class DnsRoleStack extends CommonStack {
    public readonly roleName: string;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const novaDomainServiceAccount = "791674550530";

        const role = new Role(this, "NovaDomainServiceRole", {
            roleName: "NovaDomainServiceRoute53Role",
            assumedBy: new AccountPrincipal(novaDomainServiceAccount),
            description:
                "Allows NovaDomainService to manage Route 53 hosted zones for people.aws.dev domains",
        });

        role.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "route53:CreateHostedZone",
                    "route53:DeleteHostedZone",
                    "route53:GetHostedZone",
                    "route53:ListHostedZones",
                    "route53:ListHostedZonesByName",
                    "route53:ChangeResourceRecordSets",
                    "route53:ListResourceRecordSets",
                    "route53:GetChange",
                ],
                resources: ["*"],
            }),
        );

        NagSuppressions.addResourceSuppressions(role, [
            {
                id: "AwsSolutions-IAM5",
                reason: "Route 53 hosted zone ARNs are not known ahead of time; wildcard is required for zone creation.",
            },
        ]);

        new CfnOutput(this, "roleName", {
            value: role.roleName,
            description: "Role name for NovaDomainService to assume",
        });

        new CfnOutput(this, "roleArn", {
            value: role.roleArn,
            description: "Role ARN for NovaDomainService to assume",
        });

        this.roleName = role.roleName;
    }
}
