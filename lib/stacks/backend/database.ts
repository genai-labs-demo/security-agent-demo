import { Construct } from "constructs";
import {
    Vpc,
    IVpc,
    SubnetType,
    SecurityGroup,
    Port,
    InterfaceVpcEndpoint,
    InterfaceVpcEndpointAwsService,
} from "aws-cdk-lib/aws-ec2";
import {
    DatabaseInstance,
    DatabaseInstanceEngine,
    PostgresEngineVersion,
    StorageType,
    Credentials,
    DatabaseProxy,
    ProxyTarget,
} from "aws-cdk-lib/aws-rds";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { RemovalPolicy, Duration, CustomResource } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Provider } from "aws-cdk-lib/custom-resources";
import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";
import { NagSuppressions } from "cdk-nag";
import * as path from "path";

export interface DatabaseProps {
    vpc: IVpc;
    securityGroup: SecurityGroup;
    imagesBucket: Bucket;
}

export class Database extends Construct {
    public readonly database: DatabaseInstance;
    public readonly databaseSecret: Secret;
    public readonly databaseEndpoint: string;
    public readonly databaseName: string;
    public readonly proxy: DatabaseProxy;
    public readonly proxyEndpoint: string;

    constructor(scope: Construct, id: string, props: DatabaseProps) {
        super(scope, id);

        const { vpc, securityGroup, imagesBucket } = props;

        this.databaseName = "crmdb";

        this.database = new DatabaseInstance(this, "database", {
            engine: DatabaseInstanceEngine.postgres({
                version: PostgresEngineVersion.VER_15,
            }),
            vpc,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_ISOLATED,
            },
            securityGroups: [securityGroup],
            databaseName: this.databaseName,
            credentials: Credentials.fromGeneratedSecret("postgres"),
            allocatedStorage: 100,
            storageType: StorageType.GP3,
            backupRetention: Duration.days(7),
            storageEncrypted: true,
            enablePerformanceInsights: true,
            iamAuthentication: true,
            publiclyAccessible: false,
            deletionProtection: false,
            removalPolicy: RemovalPolicy.SNAPSHOT,
        });

        this.databaseSecret = this.database.secret as Secret;
        this.databaseEndpoint = this.database.dbInstanceEndpointAddress;

        // DEMO ENVIRONMENT ONLY: These RDS security and reliability features are disabled
        // to reduce costs and simplify demo environment management.
        //
        // WARNING: For production environments, you MUST:
        // 1. Enable Multi-AZ for high availability (multiAz: true)
        // 2. Enable deletion protection (deletionProtection: true)
        // 3. Use non-default port for security through obscurity (port: custom)
        // 4. Enable automatic secret rotation (secret.addRotationSchedule())
        // 5. Remove all these suppressions
        //
        // Current demo configuration prioritizes cost savings over production reliability.
        NagSuppressions.addResourceSuppressions(
            this.database,
            [
                {
                    id: "AwsSolutions-RDS3",
                    reason: "[DEMO ONLY] Multi-AZ disabled to reduce costs (~2x cost savings). PRODUCTION REQUIRES Multi-AZ for high availability.",
                },
                {
                    id: "AwsSolutions-RDS10",
                    reason: "[DEMO ONLY] Deletion protection disabled for easy demo cleanup. PRODUCTION REQUIRES deletion protection to prevent accidental data loss.",
                },
                {
                    id: "AwsSolutions-RDS11",
                    reason: "[DEMO ONLY] Using default PostgreSQL port 5432. Production should use non-standard port as defense-in-depth measure.",
                },
                {
                    id: "AwsSolutions-SMG4",
                    reason: "[DEMO ONLY] Automatic secret rotation disabled for demo simplicity. PRODUCTION REQUIRES automatic rotation (e.g., 30-90 days).",
                },
            ],
            true
        );

        this.proxy = new DatabaseProxy(this, "proxy", {
            proxyTarget: ProxyTarget.fromInstance(this.database),
            secrets: [this.databaseSecret],
            vpc,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_ISOLATED,
            },
            securityGroups: [securityGroup],
            requireTLS: false,
            dbProxyName: "sec-agent-database-proxy",
        });

        this.proxyEndpoint = this.proxy.endpoint;
        
        // Create seeding Lambda function
        const seedFunction = new PythonFunction(this, "seedFunction", {
            entry: path.join(__dirname, "database/seed-function"),
            runtime: Runtime.PYTHON_3_12,
            timeout: Duration.minutes(15),
            memorySize: 512,
            vpc,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_ISOLATED,
            },
            securityGroups: [securityGroup],
            environment: {
                DB_PROXY_ENDPOINT: this.proxyEndpoint,
                DB_NAME: this.databaseName,
                DB_USERNAME: "postgres",
                DB_PASSWORD: this.databaseSecret.secretValueFromJson("password").unsafeUnwrap(),
            },
        });

        // Grant Lambda access to the database secret
        this.databaseSecret.grantRead(seedFunction);

        // Create custom resource provider
        const provider = new Provider(this, "seedProvider", {
            onEventHandler: seedFunction,
        });

        // Get clear data flag from CDK context
        const clearData = this.node.tryGetContext('clearDatabaseData') === true;

        // Create custom resource to trigger seeding
        new CustomResource(this, "seedResource", {
            serviceToken: provider.serviceToken,
            properties: {
                clear_data: clearData ? 'true' : 'false',
                // Always force update when clearData is true by using a timestamp
                forceUpdate: clearData ? Date.now().toString() : 'false',
            },
        });
    }
}
