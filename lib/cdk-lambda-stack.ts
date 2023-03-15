import { StackProps, Stack, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { RestApi, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Policy, PolicyStatement, Effect, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
// import { aws_s3_deployment } from 'aws-cdk-lib'; 

export class CdkLambdaStack extends Stack {

  private createWarriorsAPI: RestApi;
  private fetchWarriorsAPI: RestApi;
  private getWarriorLambda: NodejsFunction;
  private storeWarriorsLambda: NodejsFunction;
  private setupWarriorQueue: sqs.Queue

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    this.setupS3BucketAndPolicy()
    this.setupLambda()
    this.setupAPIGatewayForCreateWarriors()
    this.setupAPIGatewayForFetchWarriors()
    //this.setupDynamoDb()

  }

  /*
    Creating S3 Bucket and attach policy
  */
  private setupS3BucketAndPolicy = () => {
    const warriorBucket = new s3.Bucket(this, 'warriors-bucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      bucketName: `acolyte-warriors`
    });

    //   create the bucket policy
    const bucketPolicy = new s3.BucketPolicy(this, 'warrior-bucket-policy', {
      bucket: warriorBucket,
    });

    // add policy statements ot the bucket policy
    bucketPolicy.document.addStatements(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal('lambda.amazonaws.com')],
        actions: [
          's3:GetObject',
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObjectAcl",
          "s3:AbortMultipartUpload"
        ],
        resources: [`${warriorBucket.bucketArn}/*`],
      }),
    );

    this.setupWarriorQueue = new sqs.Queue(this, 'warrior-file-uploaded');

    warriorBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SqsDestination(this.setupWarriorQueue),
      // only send message to queue if object matches the filter
      // {prefix: 'test/', suffix: '.png'},
    );
    new CfnOutput(this, 'bucketName', {
      value: warriorBucket.bucketName,
    });
  }

  private setupDynamoDb = () => {
    // 👇 create Dynamodb table
    // const warriorsTable = new dynamodb.Table(this, 'Warriors', {
    //   billingMode: dynamodb.BillingMode.PROVISIONED,
    //   readCapacity: 1,
    //   writeCapacity: 1,
    //   partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
    //   //removalPolicy: RemovalPolicy.DESTROY,
    //   // sortKey: { name: 'fightsWon', type: dynamodb.AttributeType.NUMBER },
    //   // pointInTimeRecovery: false,
    //   // tableClass: dynamodb.TableClass.STANDARD_INFREQUENT_ACCESS,
    // });

    // //Required permissions for Lambda function to interact with Warrior table
    // const warriorTablePermissionPolicy = new PolicyStatement({
    //   actions: [
    //     "dynamodb:BatchGetItem",
    //     "dynamodb:GetItem",
    //     "dynamodb:Scan",
    //     "dynamodb:Query",
    //     "dynamodb:BatchWriteItem",
    //     "dynamodb:PutItem",
    //     "dynamodb:UpdateItem",
    //     "dynamodb:DeleteItem"
    //   ],
    //   resources: [warriorsTable.tableArn]
    // });

    // // Attaching an inline policy to the role
    // this.storeWarriorsLambda.role?.attachInlinePolicy(
    //   new Policy(this, `WarriorTablePermissions`, {
    //     statements: [warriorTablePermissionPolicy],
    //   }),
    // );

    // warriorsTable.grantReadWriteData(this.storeWarriorsLambda);
  }
  /*
    Creating lambda function for handling API endpoints
  */
  private setupLambda = () => {

    const todoTable = new dynamodb.Table(this, 'todo', {
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
      tableName: 'todo',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.NUMBER },
      //removalPolicy: RemovalPolicy.DESTROY,
      // sortKey: { name: 'fightsWon', type: dynamodb.AttributeType.NUMBER },
      // pointInTimeRecovery: false,
      // tableClass: dynamodb.TableClass.STANDARD_INFREQUENT_ACCESS,
    });
    this.getWarriorLambda = new NodejsFunction(this, `CreateWarriorHandler`, {
      runtime: Runtime.NODEJS_16_X,
      handler: "handler",
      entry: path.join(__dirname, `/../src/lambda/warriors/index.ts`)
    });

    this.storeWarriorsLambda = new NodejsFunction(this, `FetchWarriorHandler`, {
      runtime: Runtime.NODEJS_16_X,
      handler: "handler",
      entry: path.join(__dirname, `/../src/lambda/warriors/fetchAllWarriors.ts`)
    });

    todoTable.grantReadWriteData(this.storeWarriorsLambda);


    const s3ListBucketsPolicy = new PolicyStatement({
      actions: ['s3:*'],
      resources: ['arn:aws:s3:::*']
    });

    // add the policy to the Function's role
    this.getWarriorLambda.role?.attachInlinePolicy(
      new Policy(this, 'create-warriors-buckets-policy', {
        statements: [s3ListBucketsPolicy]
      }),
    );

    // add the policy to the Function's role
    this.storeWarriorsLambda.role?.attachInlinePolicy(
      new Policy(this, 'list-buckets-policy', {
        statements: [s3ListBucketsPolicy]
      }),
    );

    this.storeWarriorsLambda.addEventSource(
      new SqsEventSource(this.setupWarriorQueue, {
        batchSize: 10
      })
    );
  }


  /*
    API Gateway creating all warriors
  */
  private setupAPIGatewayForCreateWarriors = () => {
    this.createWarriorsAPI = new RestApi(this, `Create - Warriors - API`, {
      description: 'Create-Warriors API',
      deployOptions: {
        stageName: 'dev'
      },
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
        ],
        allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowCredentials: true,
        allowOrigins: ['http://localhost:3000'],
      },
    });
    new CfnOutput(this, 'apiUrl', { value: this.createWarriorsAPI.url });
    const warriors = this.createWarriorsAPI.root.addResource('warriors');
    warriors.addMethod('GET', new LambdaIntegration(this.getWarriorLambda));
  }

  /*
   API Gateway for fetching warriors
 */
  private setupAPIGatewayForFetchWarriors = () => {
    this.fetchWarriorsAPI = new RestApi(this, `Fetch - Warriors - API`, {
      description: 'Fetch-Warriors API',
      deployOptions: {
        stageName: 'dev'
      },
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
        ],
        allowMethods: ['GET'],
        allowCredentials: true,
        allowOrigins: ['http://localhost:3000'],
      },
    });
    new CfnOutput(this, 'fetchWarriorsAPIUrl', { value: this.fetchWarriorsAPI.url });
    const fetchWarriorsAPI = this.fetchWarriorsAPI.root.addResource('fetchWarriors');
    fetchWarriorsAPI.addMethod('GET', new LambdaIntegration(this.storeWarriorsLambda));
  }
}
