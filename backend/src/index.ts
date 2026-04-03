import express from 'express'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import { PORT, FRONTEND_URL } from './config/env'
import cors from 'cors'
import { dynamoClient } from './providers/dynamodb.connect'
import { ListTablesCommand } from '@aws-sdk/client-dynamodb'
import { HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3'
import s3Client from './providers/s3.connect'
import { S3_BUCKET_NAME } from './config/env'
import pineconeService from './providers/pinecone.connect'
import { testAzureConnection } from './providers/azure-ai.connect'
import S3Router from './routes/uploads.route'
import AuthRouter from './routes/auth.route'
import EmbeddingRouter from './routes/embedding.route'
import ChatRouter from './routes/chat.route'
import { setupSwagger } from './config/swagger'


const app = express()

app.use(morgan('tiny'))
app.use(cookieParser())
app.use(bodyParser.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(cors())

setupSwagger(app)

const checkConnections = async () => {
    try {
        // Test DynamoDB connection
        try {
            const command = new ListTablesCommand({})
            const result = await dynamoClient.send(command)
            console.log(`DynamoDB: Connected (${result.TableNames?.length || 0} tables)`)
        } catch (error) {
            console.warn('DynamoDB connection issue:', (error as Error).message)
        }
        
        // Test Pinecone connection  
        const pineconeHealthy = await pineconeService.healthCheck()
        if (pineconeHealthy) {
            console.log('Pinecone: Connected')
        } else {
            console.warn('Pinecone: Connection failed')
        }

        // Test Azure AI connection  
        const isAzureReady = await testAzureConnection()
        if (isAzureReady) {
            console.log('Azure AI: Connected')
        } else {
            console.warn('Azure AI: Connection issues')
        }
        
        // Test S3 connection
        try {
            // First check if bucket exists
            const s3Command = new HeadBucketCommand({ Bucket: S3_BUCKET_NAME })
            await s3Client.send(s3Command)
            console.log(`S3: Bucket ${S3_BUCKET_NAME} accessible`)
        } catch (error: any) {
            console.warn(`S3: Bucket ${S3_BUCKET_NAME} not accessible`)
            
            if (error.name === 'NoSuchBucket') {
                try {
                    const createCommand = new CreateBucketCommand({ 
                        Bucket: S3_BUCKET_NAME,
                        // Don't specify LocationConstraint for us-east-1 (default region)
                    })
                    await s3Client.send(createCommand)
                    console.log(`S3: Created bucket ${S3_BUCKET_NAME}`)
                } catch (createError: any) {
                    console.error(`S3: Failed to create bucket - ${createError.message}`)
                }
            } else if (error.name === 'Forbidden') {
                console.error('S3: Access denied - Check credentials and permissions')
            } else {
                console.error(`S3: Connection error - ${error.name}: ${error.message}`)
            }
        }
        
        console.log('Backend: Server ready')
    } catch (error) {
        console.error('Connection error:', error)
        console.warn('Running in development mode with limited functionality')
        // Don't exit in development - let the app run
    }
}

app.use(cors({
    origin: FRONTEND_URL,
    credentials: true
}))

app.use('/health', (req, res) => res.send('API is running...'))

app.use('/api/v1/auth', AuthRouter)
app.use('/api/v1/s3', S3Router)
app.use('/api/v1/embedding', EmbeddingRouter)
app.use('/api/v1/chat', ChatRouter)

app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`)
    console.log(`API docs: http://localhost:${PORT}/api-docs`)
    await checkConnections()
})