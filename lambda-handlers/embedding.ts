import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    console.log('Embedding Lambda Event:', JSON.stringify(event, null, 2))

    try {
        const { httpMethod, path, body } = event
        const requestBody = body ? JSON.parse(body) : {}

        // Temporary response - replace with actual embedding logic
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            },
            body: JSON.stringify({
                message: 'Embedding endpoint - implementation needed',
                method: httpMethod,
                path: path,
                received: requestBody
            }),
        }

    } catch (error) {
        console.error('Embedding Lambda Error:', error)
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                message: 'Internal server error',
                error: error instanceof Error ? error.message : 'Unknown error'
            }),
        }
    }
}