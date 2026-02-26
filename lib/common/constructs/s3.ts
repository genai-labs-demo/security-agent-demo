import { RemovalPolicy } from "aws-cdk-lib";
import { Bucket, BucketProps, BlockPublicAccess, BucketEncryption, HttpMethods } from "aws-cdk-lib/aws-s3";
import { IKey } from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";

export interface CommonBucketProps extends Omit<BucketProps, "blockPublicAccess" | "enforceSSL" | "encryption" | "encryptionKey"> {
    eventBridgeEnabled?: boolean;
    encryptionKey?: IKey;
}

export class CommonBucket extends Bucket {
    constructor(scope: Construct, id: string, props?: CommonBucketProps) {
        const { encryptionKey, ...restProps } = props || {};

        super(scope, id, {
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            eventBridgeEnabled: restProps?.eventBridgeEnabled ?? false,
            ...(encryptionKey && { encryption: BucketEncryption.KMS, encryptionKey, bucketKeyEnabled: true }),
            ...restProps,
        });
    }
}

export interface CommonWebBucketProps extends CommonBucketProps {
    allowedOrigins: string[];
}

export class CommonWebBucket extends Bucket {
    constructor(scope: Construct, id: string, props: CommonWebBucketProps) {
        const { allowedOrigins, ...bucketProps } = props;
        const { allowedOrigins, encryptionKey, ...bucketProps } = props;
        super(scope, id, {
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            eventBridgeEnabled: bucketProps?.eventBridgeEnabled ?? false,
            cors: [
            ...(encryptionKey && { encryption: BucketEncryption.KMS, encryptionKey, bucketKeyEnabled: true }),
                {
                    allowedMethods: [HttpMethods.GET, HttpMethods.PUT, HttpMethods.POST, HttpMethods.DELETE],
                    allowedOrigins,
                    allowedHeaders: ["*"],
                },
            ],
            ...bucketProps,
        });
    }
}
