import { RemovalPolicy } from "aws-cdk-lib";
import { Bucket, BucketProps, BlockPublicAccess, HttpMethods } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { isProductionEnvironment } from "../utilities";

export interface CommonBucketProps extends Omit<BucketProps, "blockPublicAccess" | "enforceSSL"> {
    eventBridgeEnabled?: boolean;
}

export class CommonBucket extends Bucket {
    constructor(scope: Construct, id: string, props?: CommonBucketProps) {
        // Use safe defaults for production, destructive for dev/demo
        const isProduction = isProductionEnvironment(scope);
        const defaultAutoDelete = !isProduction;
        const defaultRemovalPolicy = isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;
        
        // Allow explicit override via props
        const autoDeleteObjects = props?.autoDeleteObjects ?? defaultAutoDelete;
        const removalPolicy = props?.removalPolicy ?? defaultRemovalPolicy;
        
        super(scope, id, {
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            eventBridgeEnabled: props?.eventBridgeEnabled ?? false,
            ...props,
            // Apply after props spread to ensure environment-aware defaults are not 
            // accidentally overridden, but still allow explicit overrides
            autoDeleteObjects,
            removalPolicy,
        });
    }
}

export interface CommonWebBucketProps extends CommonBucketProps {
    allowedOrigins: string[];
}

export class CommonWebBucket extends Bucket {
    constructor(scope: Construct, id: string, props: CommonWebBucketProps) {
        const { allowedOrigins, ...bucketProps } = props;
        
        // Use safe defaults for production, destructive for dev/demo
        const isProduction = isProductionEnvironment(scope);
        const defaultAutoDelete = !isProduction;
        const defaultRemovalPolicy = isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;
        
        // Allow explicit override via props
        const autoDeleteObjects = bucketProps?.autoDeleteObjects ?? defaultAutoDelete;
        const removalPolicy = bucketProps?.removalPolicy ?? defaultRemovalPolicy;

        super(scope, id, {
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            eventBridgeEnabled: bucketProps?.eventBridgeEnabled ?? false,
            cors: [
                {
                    allowedMethods: [HttpMethods.GET, HttpMethods.PUT, HttpMethods.POST, HttpMethods.DELETE],
                    allowedOrigins,
                    allowedHeaders: ["*"],
                },
            ],
            ...bucketProps,
            // Apply after props spread to ensure environment-aware defaults are not 
            // accidentally overridden, but still allow explicit overrides
            autoDeleteObjects,
            removalPolicy,
        });
    }
}
