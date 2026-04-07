import express from 'express'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import { PORT, FRONTEND_URL } from './config/env'
import cors from 'cors'
import dynamoService from './providers/dynamodb.connect'
import { ListTablesCommand } from '@aws-sdk/client-dynamodb'
import { HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3'
import s3Service from './providers/s3.connect'
import { S3_BUCKET_NAME } from './config/env'
import pineconeService from './providers/pinecone.connect'
import azureService from './providers/azure-ai.connect'
import S3Router from './routes/uploads.route'
import AuthRouter from './routes/auth.route'
import EmbeddingRouter from './routes/embedding.route'
import ChatRouter from './routes/chat.route'
import { setupSwagger } from './config/swagger'
import { initializeObservers } from './utils/event.manager'

const app = express()

// Initialize middleware
app.use(morgan('tiny'))
app.use(cookieParser())
app.use(bodyParser.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Setup CORS
app.use(cors({
    origin: FRONTEND_URL,
    credentials: true
}))

// Setup Swagger documentation
setupSwagger(app)

// Initialize Observer Pattern
initializeObservers()
console.log('🎯 Design Patterns initialized: Observer, Factory, Strategy, Repository, Command, Builder')

const checkConnections = async () => {
    try {
        console.log('🔍 Checking service connections...')
        
        // Test DynamoDB connection
        try {
            const command = new ListTablesCommand({})
            const result = await dynamoService.getRawClient().send(command)
            console.log(`✅ DynamoDB: Connected (${result.TableNames?.length || 0} tables)`)
        } catch (error) {
            console.warn('⚠️ DynamoDB connection issue:', (error as Error).message)
        }
        
        // Test Pinecone connection  
        const pineconeHealthy = await pineconeService.healthCheck()
        if (pineconeHealthy) {
            console.log('✅ Pinecone: Connected')
        } else {
            console.warn('⚠️ Pinecone: Connection failed')
        }

        // Test Azure AI connection  
        const isAzureReady = await azureService.healthCheck()
        if (isAzureReady) {
            console.log('✅ Azure AI: Connected')
        } else {
            console.warn('⚠️ Azure AI: Connection issues')
        }
        
        // Test S3 connection
        try {
            const s3Command = new HeadBucketCommand({ Bucket: S3_BUCKET_NAME })
            await s3Service.getS3Client().send(s3Command)
            console.log(`✅ S3: Bucket ${S3_BUCKET_NAME} accessible`)
        } catch (error: any) {
            console.warn(`⚠️ S3: Bucket ${S3_BUCKET_NAME} not accessible`)
            
            if (error.name === 'NoSuchBucket') {
                try {
                    const createCommand = new CreateBucketCommand({ 
                        Bucket: S3_BUCKET_NAME,
                    })
                    await s3Service.getS3Client().send(createCommand)
                    console.log(`✅ S3: Created bucket ${S3_BUCKET_NAME}`)
                } catch (createError: any) {
                    console.error(`❌ S3: Failed to create bucket - ${createError.message}`)
                }
            } else if (error.name === 'Forbidden') {
                console.error('❌ S3: Access denied - Check credentials and permissions')
            } else {
                console.error(`❌ S3: Connection error - ${error.name}: ${error.message}`)
            }
        }
        
        console.log('🚀 Backend: Server ready with Design Patterns')
        console.log('📊 Active Patterns:')
        console.log('  • Singleton: Database connections, Services')
        console.log('  • Repository: Data access layer')
        console.log('  • Strategy: AI models, File processing, Storage')
        console.log('  • Factory: Document processors, Error creators')
        console.log('  • Observer: Event notifications')
        console.log('  • Command: Operations with undo support')
        console.log('  • Builder: Response and query builders')
        console.log('  • Decorator: Middleware (planned)')
        
    } catch (error) {
        console.error('❌ Connection error:', error)
        console.warn('⚠️ Running in development mode with limited functionality')
        // Don't exit in development - let the app run
    }
}

// Health check endpoint
app.use('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        patterns: [
            'Singleton', 'Repository', 'Strategy', 'Factory', 
            'Observer', 'Command', 'Builder'
        ],
        message: 'ChatBot API with Design Patterns is running'
    })
})

// API Routes
app.use('/api/v1/auth', AuthRouter)
app.use('/api/v1/s3', S3Router) 
app.use('/api/v1/embedding', EmbeddingRouter)
app.use('/api/v1/chat', ChatRouter)

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('❌ Global error handler:', error)
    
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString()
    })
})

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    })
})

// Start server
const startServer = async () => {
    await checkConnections()
    
    app.listen(PORT, () => {
        console.log(`🎉 Server running on port ${PORT}`)
        console.log(`📘 API Documentation: http://localhost:${PORT}/api-docs`)
        console.log(`🏥 Health Check: http://localhost:${PORT}/health`)
        console.log('🎨 Architecture: Clean Code with Design Patterns')
    })
}

startServer().catch(error => {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
})