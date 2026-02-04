import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"
import { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } from "../config/env"


const dbclient = new DynamoDBClient({
    region: AWS_REGION,
    credentials:{
        accessKeyId: AWS_ACCESS_KEY_ID!,
        secretAccessKey: AWS_SECRET_ACCESS_KEY!
    }
})

export const dynamoClient = DynamoDBDocumentClient.from(dbclient)

