import OpenAI from 'openai'
import { 
    AZURE_OPENAI_ENDPOINT, 
    AZURE_OPENAI_API_KEY, 
    AZURE_OPENAI_API_VERSION,
    AZURE_LLM_DEPLOYMENT_NAME,
    AZURE_EMBEDDING_DEPLOYMENT_NAME
} from '../config/env'

if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
    throw new Error('Azure OpenAI configuration missing. Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY.')
}

// Configure OpenAI client for Azure  
const azureClient = new OpenAI({
    apiKey: AZURE_OPENAI_API_KEY,
    baseURL: `${AZURE_OPENAI_ENDPOINT}/openai/deployments`,
    defaultQuery: { 'api-version': AZURE_OPENAI_API_VERSION },
    defaultHeaders: {
        'api-key': AZURE_OPENAI_API_KEY,
    },
})

export default azureClient

// Test connection
export async function testAzureConnection(): Promise<boolean> {
    try {
        console.log('🔍 Testing Azure OpenAI client configuration...')
        console.log(`📍 Endpoint: ${AZURE_OPENAI_ENDPOINT}`)
        console.log(`🔌 API Version: ${AZURE_OPENAI_API_VERSION}`)
        console.log(`🤖 LLM Deployment: ${AZURE_LLM_DEPLOYMENT_NAME}`)
        console.log(`📝 Embedding Deployment: ${AZURE_EMBEDDING_DEPLOYMENT_NAME}`)
        
        // Test LLM deployment
        if (AZURE_LLM_DEPLOYMENT_NAME) {
            try {
                await azureClient.chat.completions.create({
                    model: AZURE_LLM_DEPLOYMENT_NAME,
                    messages: [{ role: "user", content: "Test connection" }],
                    max_completion_tokens: 1
                })
                console.log('✅ LLM deployment test successful')
            } catch (error: any) {
                console.error('❌ LLM deployment test failed. Full error details:')
                console.error('Error object:', JSON.stringify(error, null, 2))
                console.error('Error status:', error?.status || error?.response?.status || 'N/A')
                console.error('Error message:', error?.message || error?.response?.data?.error?.message || 'N/A')
                
                // If this is a 404, the deployment doesn't exist
                const status = error?.status || error?.response?.status
                if (status === 404) {
                    console.error(`🚨 Deployment '${AZURE_LLM_DEPLOYMENT_NAME}' not found in Azure AI resource`)
                    console.log('💡 Please check deployment name in Azure AI Studio or create the deployment')
                }
                
                return false
            }
        }
        
        return true
    } catch (error) {
        console.error('❌ Azure OpenAI connection test failed:', error)
        return false
    }
}