import { CfnOutput, StackProps } from "aws-cdk-lib";
import {
    AccountPrincipal,
    Effect,
    PolicyStatement,
    Role,
} from "aws-cdk-lib/aws-iam";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { execSync } from "child_process";
import { CommonStack } from "../../common/constructs/stack";

const ROLE_NAME = "NovaDomainServiceRoute53Role";
const NOVA_ACCOUNT = "791674550530";

/**
 * Creates the IAM role that allows NovaDomainService (people.aws.dev)
 * to manage Route 53 hosted zones in this account.
 *
 * If the role was pre-created outside of CDK (e.g. via CLI script),
 * it is imported instead of re-created to avoid AlreadyExists errors.
 */
export class DnsRoleStack extends CommonStack {
    public readonly roleName: string;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Check if the role already exists outside of CloudFormation
        const roleExists = (() => {
            try {
                execSync(`aws iam get-role --role-name ${ROLE_NAME} 2>/dev/null`, { stdio: "pipe" });
                return true;
            } catch {
                return false;
            }
        })();

        if (roleExists) {
            // Import the existing role — CDK won't try to create it
            const role = Role.fromRoleName(this, "NovaDomainServiceRole", ROLE_NAME);

            new CfnOutput(this, "roleName", {
                value: role.roleName,
                description: "Role name for NovaDomainService to assume (imported)",
            });

            new CfnOutput(this, "roleArn", {
                value: role.roleArn,
                description: "Role ARN for NovaDomainService to assume (imported)",
            });

            this.roleName = role.roleName;
        } else {
            // Create the role fresh
            const role = new Role(this, "NovaDomainServiceRole", {
                roleName: ROLE_NAME,
                assumedBy: new AccountPrincipal(NOVA_ACCOUNT),
                description: "Allows NovaDomainService to manage Route 53 hosted zones for people.aws.dev domains",
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
}
