// @export {"deleteFile": true}

import { RemovalPolicy, SecretValue, Stack, Stage } from "aws-cdk-lib";
import {
    OAuthScope,
    OidcAttributeRequestMethod,
    ProviderAttribute,
    StringAttribute,
    UserPool,
    UserPoolClient,
    UserPoolClientIdentityProvider,
    UserPoolClientProps,
    UserPoolDomain,
    UserPoolDomainOptions,
    UserPoolIdentityProviderOidc,
    UserPoolProps,
} from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

function getProfile(scope: Construct) {
    return `${Stage.of(scope)!.stageName}-${scope.node.getContext("projectId")}`;
}

function getAccountDetail(scope: Construct, detail: string) {
    return scope.node.getContext("accounts")[Stage.of(scope)!.stageName]?.[detail];
}

export class FederateUserPool extends UserPool {
    public addDomain(id: string, options?: UserPoolDomainOptions): UserPoolDomain {
        return super.addDomain(id, {
            ...options,
            cognitoDomain: {
                domainPrefix: `${this.node.getContext("projectId")}-${Stack.of(this).account}`,
            },
        });
    }
    constructor(scope: Construct, id: string, props: UserPoolProps) {
        // Use explicit removalPolicy from props, defaulting to RETAIN for data safety
        const removalPolicy = props.removalPolicy !== undefined ? props.removalPolicy : RemovalPolicy.RETAIN;
        
        super(scope, id, {
            ...props,
            removalPolicy: removalPolicy,
            // Use explicit customAttributes from props - no context-dependent logic
        });
    }
}

export class FederateUserPoolClient extends UserPoolClient {
    constructor(scope: Construct, id: string, props: UserPoolClientProps) {
        // Remove context-dependent authentication configuration
        // All authentication settings should be explicitly passed via props
        super(scope, id, {
            ...props,
            // Use explicit props for authentication configuration
            // authFlows: defined by caller
            // oAuth: defined by caller
            // supportedIdentityProviders: defined by caller
            // This ensures consistent security posture across all deployment environments
            // and eliminates context-dependent security misconfigurations
        });
    }
}
