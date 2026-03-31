import OpenAI from 'openai'
import { 
    AZURE_OPENAI_ENDPOINT, 
    AZURE_OPENAI_API_KEY, 
    AZURE_OPENAI_API_VERSION 
} from '../config/env'

if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
    throw new Error('Azure OpenAI configuration missing. Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY.')
}

// Configure OpenAI client for Azure  
const azureClient = new OpenAI({
    apiKey: AZURE_OPENAI_API_KEY,
    baseURL: `${AZURE_OPENAI_ENDPOINT}`,
    defaultQuery: { 'api-version': AZURE_OPENAI_API_VERSION },
    defaultHeaders: {
        'api-key': AZURE_OPENAI_API_KEY,
    },
})

export default azureClient

// Test connection
export async function testAzureConnection(): Promise<boolean> {
    try {
        console.log('🔍 Azure OpenAI client configured successfully')
        console.log(`📍 Endpoint: ${AZURE_OPENAI_ENDPOINT}`)
        console.log(`🔌 API Version: ${AZURE_OPENAI_API_VERSION}`)
        return true
    } catch (error) {
        console.error('❌ Azure OpenAI connection failed:', error)
        return false
    }
}