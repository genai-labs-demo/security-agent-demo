import { Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import * as path from "path";
import { CommonBucket, CommonWebBucket } from "../../../common/constructs/s3";
import { S3EncryptionKey } from "../../../common/constructs/kms";

interface StorageProps {
    urls: string[];
}

export class Storage extends Construct {
    public readonly storageBucket: Bucket;

    constructor(scope: Construct, id: string, props: StorageProps) {
        super(scope, id);

        const { urls } = props;

        // Create KMS key for S3 bucket encryption
        const s3EncryptionKey = new S3EncryptionKey(
            this,
            "s3EncryptionKey",
            "KMS key for backend storage S3 bucket encryption"
        );

        const loggingBucket = new CommonBucket(this, "loggingBucket", {
            encryptionKey: s3EncryptionKey,
        });

        this.storageBucket = new CommonWebBucket(this, "storageBucket", {
            allowedOrigins: urls,
            eventBridgeEnabled: true,
            serverAccessLogsBucket: loggingBucket,
            encryptionKey: s3EncryptionKey,
        });

        new BucketDeployment(this, "storageDeployment", {
            sources: [Source.asset(path.join(__dirname, "assets"))],
            destinationBucket: this.storageBucket,
        });
    }
}
