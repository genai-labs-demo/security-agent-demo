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

        // Suppress CDK Nag warnings for demo environment
        NagSuppressions.addResourceSuppressions(
            this.database,
            [
                {
                    id: "AwsSolutions-RDS3",
                    reason: "Multi-AZ not required for demo environment - reduces cost",
                },
                {
                    id: "AwsSolutions-RDS10",
                    reason: "Deletion protection disabled for demo environment - allows easy cleanup",
                },
                {
                    id: "AwsSolutions-RDS11",
                    reason: "Default port acceptable for demo environment",
                },
                {
                    id: "AwsSolutions-SMG4",
                    reason: "Automatic rotation not required for demo environment",
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
            requireTLS: true,
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
