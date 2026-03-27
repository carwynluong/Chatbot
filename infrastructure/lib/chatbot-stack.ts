import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'
import * as path from 'path'
import 'source-map-support/register'

export class ChatbotStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        // S3 Bucket for file uploads (if not already exists)
        const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
            bucketName: `chatbot-documents-${cdk.Aws.ACCOUNT_ID}`,
            versioned: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            cors: [{
                allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
                allowedOrigins: ['*'],
                allowedHeaders: ['*'],
            }],
        })

        // DynamoDB Tables
        const usersTable = new dynamodb.Table(this, 'UsersTable', {
            tableName: 'Users',
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        })

        // Add GSI for email lookup
        usersTable.addGlobalSecondaryIndex({
            indexName: 'email-index',
            partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
        })

        const documentsTable = new dynamodb.Table(this, 'DocumentsTable', {
            tableName: 'DocumentEmbeddings',
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        })

        // Add GSI for status lookup
        documentsTable.addGlobalSecondaryIndex({
            indexName: 'status-index',
            partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
        })

        const chatTable = new dynamodb.Table(this, 'ChatTable', {
            tableName: 'ChatHistory',
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        })

        // IAM Role for Lambda functions
        const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess')
            ],
        })

        // Add DynamoDB permissions
        usersTable.grantFullAccess(lambdaRole)
        documentsTable.grantFullAccess(lambdaRole)
        chatTable.grantFullAccess(lambdaRole)

        // Environment variables for Lambda
        const commonEnvVars = {
            USER_TABLE_NAME: usersTable.tableName,
            DOCUMENT_TABLE_NAME: documentsTable.tableName,
            CHAT_TABLE_NAME: chatTable.tableName,
            S3_BUCKET_NAME: documentsBucket.bucketName,
            AWS_REGION: cdk.Aws.REGION,
            // These should be set in Lambda environment or AWS Secrets Manager
            PINECONE_API_KEY: process.env.PINECONE_API_KEY || '',
            PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME || 'chatbot-document-embeddings',
            PINECONE_ENVIRONMENT: process.env.PINECONE_ENVIRONMENT || 'gcp-starter',
            JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret',
            REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret',
            EMBEDDING_MODELID: 'amazon.titan-embed-text-v1',
            GENARATE_MODELID: 'anthropic.claude-3-sonnet-20240229-v1:0',
            AUTHROPIC_VERSION: 'bedrock-2023-05-31',
            MAX_TOKEN: '4000',
            TEMPERATURE: '0.7',
            TOP_P: '0.9',
            TOP_K: '5',
            ROLE: 'user'
        }

        // Auth Lambda Function
        const authFunction = new lambda.Function(this, 'AuthFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'auth.handler',
            code: lambda.Code.fromAsset(path.join(process.cwd(), 'lambda-handlers')),
            role: lambdaRole,
            environment: commonEnvVars,
            timeout: cdk.Duration.seconds(30),
            memorySize: 512,
        })

        // Upload Lambda Function  
        const uploadFunction = new lambda.Function(this, 'UploadFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'upload.handler',
            code: lambda.Code.fromAsset(path.join(process.cwd(), 'lambda-handlers')),
            role: lambdaRole,
            environment: commonEnvVars,
            timeout: cdk.Duration.seconds(30),
            memorySize: 512,
        })

        // Embedding Lambda Function (for processing files)
        const embeddingFunction = new lambda.Function(this, 'EmbeddingFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'embedding.handler',
            code: lambda.Code.fromAsset(path.join(process.cwd(), 'lambda-handlers')),
            role: lambdaRole,
            environment: commonEnvVars,
            timeout: cdk.Duration.minutes(15), // Longer timeout for file processing
            memorySize: 1024,
        })

        // Chat Lambda Function
        const chatFunction = new lambda.Function(this, 'ChatFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'chat.handler',
            code: lambda.Code.fromAsset(path.join(process.cwd(), 'lambda-handlers')),
            role: lambdaRole,
            environment: commonEnvVars,
            timeout: cdk.Duration.seconds(30),
            memorySize: 1024,
        })

        // API Gateway
        const api = new apigateway.RestApi(this, 'ChatbotApi', {
            restApiName: 'Chatbot API',
            description: 'Serverless Chatbot API with RAG capabilities',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
            },
        })

        // API Gateway integrations
        const authIntegration = new apigateway.LambdaIntegration(authFunction)
        const uploadIntegration = new apigateway.LambdaIntegration(uploadFunction)
        const embeddingIntegration = new apigateway.LambdaIntegration(embeddingFunction)
        const chatIntegration = new apigateway.LambdaIntegration(chatFunction)

        // API Routes
        const v1 = api.root.addResource('api').addResource('v1')

        // Auth routes
        const auth = v1.addResource('auth')
        auth.addResource('register').addMethod('POST', authIntegration)
        auth.addResource('login').addMethod('POST', authIntegration)
        auth.addResource('refresh').addMethod('POST', authIntegration)
        auth.addResource('logout').addMethod('POST', authIntegration)

        // S3/Upload routes
        const s3Routes = v1.addResource('s3')
        s3Routes.addResource('uploads').addMethod('POST', uploadIntegration) // Upload files
        s3Routes.addResource('list-object').addMethod('GET', uploadIntegration) // List files
        s3Routes.addResource('uploads').addResource('{key+}').addMethod('GET', uploadIntegration) // Get file URL

        // Embedding routes  
        const embedding = v1.addResource('embedding')
        embedding.addResource('process').addMethod('POST', embeddingIntegration)

        // Chat routes
        const chat = v1.addResource('chat')
        chat.addMethod('POST', chatIntegration) // Chat query
        chat.addResource('save').addMethod('POST', chatIntegration) // Save chat
        chat.addResource('history').addResource('{userId}').addMethod('GET', chatIntegration) // Get chat history

        // Outputs
        new cdk.CfnOutput(this, 'ApiUrl', {
            value: api.url,
            description: 'API Gateway URL',
        })

        new cdk.CfnOutput(this, 'S3BucketName', {
            value: documentsBucket.bucketName,
            description: 'S3 Bucket for document storage',
        })

        new cdk.CfnOutput(this, 'UsersTableName', {
            value: usersTable.tableName,
            description: 'DynamoDB Users Table',
        })

        new cdk.CfnOutput(this, 'DocumentsTableName', {
            value: documentsTable.tableName,
            description: 'DynamoDB Documents Table',
        })

        new cdk.CfnOutput(this, 'ChatTableName', {
            value: chatTable.tableName,  
            description: 'DynamoDB Chat History Table',
        })
    }
}