import { RemovalPolicy } from "aws-cdk-lib";
import { Key, KeyProps } from "aws-cdk-lib/aws-kms";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface CommonKeyProps extends Omit<KeyProps, "enableKeyRotation" | "removalPolicy"> {
    description?: string;
}

export class CommonKey extends Key {
    constructor(scope: Construct, id: string, props?: CommonKeyProps) {
        super(scope, id, {
            enableKeyRotation: true,
            removalPolicy: RemovalPolicy.DESTROY,
            description: props?.description || "KMS Customer Managed Key",
            ...props,
        });

        // Grant S3 service principal access to use the key for bucket encryption
        this.grantEncryptDecrypt(new ServicePrincipal("s3.amazonaws.com"));

        // Grant CloudWatch Logs service principal access for log encryption
        this.grantEncryptDecrypt(new ServicePrincipal("logs.amazonaws.com"));
    }
}

export class S3EncryptionKey extends CommonKey {
    constructor(scope: Construct, id: string, description?: string) {
        super(scope, id, {
            description: description || "KMS key for S3 bucket encryption",
            alias: `alias/${id}`,
        });
    }
}
