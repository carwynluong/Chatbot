import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"
import { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } from "../config/env"

export class DynamoDBService {
    private static instance: DynamoDBService
    private dbClient: DynamoDBClient
    private dynamoClient: DynamoDBDocumentClient

    private constructor() {
        this.dbClient = new DynamoDBClient({
            region: AWS_REGION as string,
            credentials: {
                accessKeyId: AWS_ACCESS_KEY_ID!,
                secretAccessKey: AWS_SECRET_ACCESS_KEY!
            }
        })
        this.dynamoClient = DynamoDBDocumentClient.from(this.dbClient)
    }

    static getInstance(): DynamoDBService {
        if (!DynamoDBService.instance) {
            DynamoDBService.instance = new DynamoDBService()
        }
        return DynamoDBService.instance
    }

    getDynamoClient(): DynamoDBDocumentClient {
        return this.dynamoClient
    }

    // For admin operations like ListTables, health checks
    getRawClient(): DynamoDBClient {
        return this.dbClient
    }

    async healthCheck(): Promise<boolean> {
        try {
            const command = new ListTablesCommand({})
            await this.dbClient.send(command)
            // console.log('DynamoDB connection successful')
            return true
        } catch (error) {
            console.error('❌ DynamoDB connection failed:', error)
            return false
        }
    }
}

export default DynamoDBService.getInstance()

