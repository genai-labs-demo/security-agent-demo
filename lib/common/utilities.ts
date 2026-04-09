import { CfnWebACL } from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";

export function createManagedRules(
    prefix: string,
    startingPriority: number,
    rules: {
        name: string;
        overrideAction?: CfnWebACL.OverrideActionProperty;
        ruleActionOverrides?: CfnWebACL.RuleActionOverrideProperty[];
    }[]
): CfnWebACL.RuleProperty[] {
    return rules.map((rule, index) => {
        const ruleName = `${prefix}-${rule.name}`;
        return {
            name: ruleName,
            priority: startingPriority + index,
            overrideAction: rule.overrideAction || {
                none: {},
            },
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: rule.name,
                    ruleActionOverrides: rule.ruleActionOverrides,
                },
            },
            visibilityConfig: {
                metricName: ruleName,
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
            },
        };
    });
}

/**
 * Determines if the current environment is a production environment.
 * This checks the CDK context 'stage' value to identify production deployments.
 * 
 * @param scope - The construct scope to check context from
 * @returns true if the environment is production, false for dev/demo environments
 */
export function isProductionEnvironment(scope: Construct): boolean {
    const stage = scope.node.root.node.tryGetContext("stage");
    
    // Treat as production if stage is explicitly set to 'prod' or 'production'
    // Default to safe (production) behavior if stage is not set
    if (!stage) {
        return true; // Safe default: treat unknown environments as production
    }
    
    return stage === "prod" || stage === "production";
}
