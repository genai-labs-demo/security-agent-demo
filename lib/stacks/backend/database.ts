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
import { RemovalPolicy, Duration, CustomResource, Stack, aws_secretsmanager } from "aws-cdk-lib";
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

        const dbPort = 5462; // Non-default port (resolves AwsSolutions-RDS11)

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
            port: dbPort,
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
                    id: "AwsSolutions-SMG4",
                    reason: "Secret rotation temporarily disabled — hosted rotation nested stack fails due to Lambda function name length exceeding 64 chars.",
                },
            ],
            true
        );
        NagSuppressions.addResourceSuppressions(this.databaseSecret, [
            {
                id: "AwsSolutions-SMG4",
                reason: "Secret rotation temporarily disabled — hosted rotation nested stack fails due to Lambda function name length exceeding 64 chars.",
            },
        ], true);

        // Also suppress via the construct tree child (the Secret is a child of DatabaseInstance)
        const secretConstruct = this.database.node.tryFindChild("Secret");
        if (secretConstruct) {
            NagSuppressions.addResourceSuppressions(secretConstruct, [
                {
                    id: "AwsSolutions-SMG4",
                    reason: "Secret rotation temporarily disabled — hosted rotation nested stack fails due to Lambda function name length exceeding 64 chars.",
                },
            ], true);
        }

        // Secret rotation temporarily disabled — the hosted rotation nested stack
        // fails due to Lambda function name length (>64 chars). Re-enable once
        // the CDK construct generates a shorter name or use a custom rotation Lambda.
        // this.databaseSecret.addRotationSchedule("rot", {
        //     automaticallyAfter: Duration.days(30),
        //     hostedRotation: aws_secretsmanager.HostedRotation.postgreSqlSingleUser({
        //         functionName: "db-secret-rotation",
        //         vpc,
        //         vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
        //         securityGroups: [securityGroup],
        //     }),
        // });


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
                DB_PROXY_ENDPOINT: this.databaseEndpoint,
                DB_PORT: String(dbPort),
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

        NagSuppressions.addResourceSuppressions(provider, [
            {
                id: "AwsSolutions-IAM5",
                reason: "CDK Provider framework appends :* to Lambda ARN for lambda:InvokeFunction to cover all qualifiers.",
            },
        ], true);

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
