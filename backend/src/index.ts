import express from 'express'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import { PORT, FRONTEND_URL } from './config/env'
import cors from 'cors'
import pool from './providers/postgresql.connect'
import S3Router from './routes/uploads.route'
import DynamoDBRouter from './routes/auth.route'
import BedrockRouter from './routes/embedding.route'
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

const databaseConnection = async () =>{
    try {
        const client = await pool.connect()
        await client.query('SELECT NOW()')
        client.release()
        console.log('Database connected successfully')
    } catch (error) {
        console.error('Database connection failed:', error)
        process.exit(1)
    }
}

app.use(cors({
    origin: FRONTEND_URL,
    credentials: true
}))

app.use('/health', (req, res) => res.send('API is running...'))

app.use('/api/v1/auth', DynamoDBRouter)
app.use('/api/v1/s3', S3Router)
app.use('/api/v1/embedding', BedrockRouter)
app.use('/api/v1/chat', ChatRouter)

app.listen(PORT, async () => {
    console.log(`Server is running on http://localhost:${PORT}`)
    console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`)
    await databaseConnection()
})