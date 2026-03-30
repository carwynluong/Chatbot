import express from 'express'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import { PORT, FRONTEND_URL } from './config/env'
import cors from 'cors'
import { dynamoClient } from './providers/dynamodb.connect'
import { ListTablesCommand } from '@aws-sdk/client-dynamodb'
import { HeadBucketCommand } from '@aws-sdk/client-s3'
import s3Client from './providers/s3.connect'
import { S3_BUCKET_NAME } from './config/env'
import pineconeService from './providers/pinecone.connect'
import S3Router from './routes/uploads.route'
import AuthRouter from './routes/auth.route'
import EmbeddingRouter from './routes/embedding.route'
import ChatRouter from './routes/chat.route'
import { setupSwagger } from './config/swagger'


const app = express()

app.use(morgan('dev'))
app.use(cookieParser())
app.use(bodyParser.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(cors())

setupSwagger(app)

const checkConnections = async () => {
    try {
        // Test DynamoDB connection
        console.log('🔍 Testing DynamoDB connection...')
        try {
            const command = new ListTablesCommand({})
            const result = await dynamoClient.send(command)
            console.log(`✅ DynamoDB connection successful - Found ${result.TableNames?.length || 0} tables`)
        } catch (error) {
            console.warn('⚠️  DynamoDB connection issue:', (error as Error).message)
        }
        
        // Test Pinecone connection  
        console.log('🔍 Testing Pinecone connection...')
        const pineconeHealthy = await pineconeService.healthCheck()
        if (pineconeHealthy) {
            console.log('✅ Pinecone connection successful')
        } else {
            console.warn('⚠️  Pinecone connection failed - check API key and index')
        }
        
        // Test S3 connection
        console.log('🔍 Testing S3 connection...')
        try {
            const s3Command = new HeadBucketCommand({ Bucket: S3_BUCKET_NAME })
            await s3Client.send(s3Command)
            console.log(`✅ S3 connection successful - bucket ${S3_BUCKET_NAME} accessible`)
        } catch (error) {
            console.warn(`⚠️  S3 connection issue with bucket ${S3_BUCKET_NAME}:`, (error as Error).message)
        }
        
        console.log('🚀 Backend server ready for development!')
    } catch (error) {
        console.error('❌ Connection error:', error)
        console.warn('⚠️  Running in development mode with limited functionality')
        console.log('💡 Check your .env file for correct API keys and configuration')
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
    console.log(`🚀 Server is running on http://localhost:${PORT}`)
    console.log(`📚 Swagger docs available at http://localhost:${PORT}/api-docs`)
    console.log(`🎯 Health check: http://localhost:${PORT}/health`)
    await checkConnections()
})