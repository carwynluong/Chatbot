import swaggerJSDoc from "swagger-jsdoc"
import swaggerUi from "swagger-ui-express"
import { Express } from "express"
import { BACKEND_URL } from "./env"

const option = {
    definition: {
        openapi: '3.0.0',
        info:{
            title: 'GenAI API',
            version: '1.0.0',
            description: 'GenAI API'
        },
        servers: [
            {
                url: BACKEND_URL,
                description: 'Development server'
            }
        ],
        components: {
            bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
        },
        
    },
    apis: ['./src/routes/*.ts', './src/controllers/*.ts']
}

const specs = swaggerJSDoc(option)

export const setupSwagger = (app: Express) => {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs))
}