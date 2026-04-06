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

// Custom Azure OpenAI client with direct API calls (more reliable than OpenAI SDK for Azure)
class AzureOpenAIClient {
    private endpoint: string
    private apiKey: string
    private apiVersion: string
    
    constructor(endpoint: string, apiKey: string, apiVersion: string) {
        this.endpoint = endpoint.replace(/\/$/, '')
        this.apiKey = apiKey
        this.apiVersion = apiVersion
    }
    
    chat = {
        completions: {
            create: async (params: {
                model: string,
                messages: any[],
                max_completion_tokens?: number,
                temperature?: number,
                max_tokens?: number,
                stream?: boolean,
                [key: string]: any
            }) => {
                const url = `${this.endpoint}/openai/deployments/${params.model}/chat/completions?api-version=${this.apiVersion}`
                
                const requestBody: any = {
                    messages: params.messages,
                    max_completion_tokens: params.max_completion_tokens || params.max_tokens || 4000,
                    temperature: params.temperature || 0.7
                }
                
                // Add optional parameters
                if (params.stream !== undefined) requestBody.stream = params.stream
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'api-key': this.apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                })
                
                if (!response.ok) {
                    const error = await response.json()
                    throw {
                        status: response.status,
                        message: error.error?.message || 'Unknown error',
                        error: error.error
                    }
                }
                
                // Handle streaming response
                if (params.stream) {
                    return this.parseStreamingResponse(response)
                }
                
                return response.json()
            }
        }
    }
    
    // Parse SSE streaming response from Azure OpenAI  
    private async *parseStreamingResponse(response: Response) {
        if (!response.body) {
            throw new Error('No response body for streaming')
        }
        
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        
        try {
            while (true) {
                const { done, value } = await reader.read()
                
                if (done) break
                
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || '' // Keep incomplete line
                
                for (const line of lines) {
                    const trimmedLine = line.trim()
                    
                    if (trimmedLine.startsWith('data: ')) {
                        const data = trimmedLine.slice(6) // Remove 'data: ' prefix
                        
                        if (data === '[DONE]') {
                            return
                        }
                        
                        try {
                            const parsed = JSON.parse(data)
                            yield parsed
                        } catch (e) {
                            // Skip malformed JSON lines  
                            console.warn('Failed to parse streaming line:', data)
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock()
        }
    }
    
    embeddings = {
        create: async (params: {
            model: string,
            input: string | string[]
        }) => {
            const url = `${this.endpoint}/openai/deployments/${params.model}/embeddings?api-version=${this.apiVersion}`
            
            console.log(`🔗 Azure Embedding Request:`, {
                url,
                model: params.model,
                inputType: typeof params.input,
                inputLength: Array.isArray(params.input) ? params.input.length : params.input?.length,
                inputPreview: Array.isArray(params.input) 
                    ? params.input[0]?.substring(0, 50) + '...'
                    : params.input?.substring(0, 50) + '...'
            })
            
            const requestBody = {
                input: params.input
            }
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'api-key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            })
            
            if (!response.ok) {
                const errorText = await response.text()
                console.error(`❌ Azure Embedding Error:`, {
                    status: response.status,
                    statusText: response.statusText,
                    url: url,
                    responseBody: errorText,
                    requestBody: requestBody
                })
                
                let errorJson
                try {
                    errorJson = JSON.parse(errorText)
                } catch {
                    errorJson = { message: errorText }
                }
                
                throw {
                    status: response.status,
                    message: errorJson.error?.message || errorJson.message || response.statusText,
                    error: errorJson.error || errorJson,
                    requestBody,
                    url
                }
            }
            
            const result = await response.json()
            console.log(`✅ Azure Embedding Success:`, {
                dataLength: result.data?.length,
                firstEmbeddingDims: result.data?.[0]?.embedding?.length,
                usage: result.usage
            })
            
            return result
        }
    }
}

// Create custom Azure client instead of OpenAI client
const azureClient = new AzureOpenAIClient(
    AZURE_OPENAI_ENDPOINT!,
    AZURE_OPENAI_API_KEY!,
    AZURE_OPENAI_API_VERSION!
)

export default azureClient

// Test connection
export async function testAzureConnection(): Promise<boolean> {
    try {
        // console.log('Testing Azure OpenAI client configuration...')
        // console.log(`Endpoint: ${AZURE_OPENAI_ENDPOINT}`)
        // console.log(`API Version: ${AZURE_OPENAI_API_VERSION}`)
        // console.log(`LLM Deployment: ${AZURE_LLM_DEPLOYMENT_NAME}`)
        // console.log(`Embedding Deployment: ${AZURE_EMBEDDING_DEPLOYMENT_NAME}`)
        
        // Test LLM deployment
        if (AZURE_LLM_DEPLOYMENT_NAME) {
            try {
                await azureClient.chat.completions.create({
                    model: AZURE_LLM_DEPLOYMENT_NAME,
                    messages: [{ 
                        role: "system", 
                        content: "You are a helpful assistant." 
                    }, { 
                        role: "user", 
                        content: "Please respond with 'Connection successful' to confirm the API is working." 
                    }],
                    max_completion_tokens: 20,
                    temperature: 0.1
                })
                // console.log('LLM deployment test successful')
            } catch (error: any) {
                console.error('❌ LLM deployment test failed. Full error details:')
                console.error('Error object:', JSON.stringify(error, null, 2))
                console.error('Error status:', error?.status || error?.response?.status || 'N/A')
                console.error('Error message:', error?.message || error?.response?.data?.error?.message || 'N/A')
                return false
            }
        }
        
        // Test Embedding deployment
        if (AZURE_EMBEDDING_DEPLOYMENT_NAME) {
            try {
                await azureClient.embeddings.create({
                    model: AZURE_EMBEDDING_DEPLOYMENT_NAME,
                    input: "test embedding"
                })
                // console.log('Embedding deployment test successful')
            } catch (error: any) {
                console.error('❌ Embedding deployment test failed. Full error details:')
                console.error('Error object:', JSON.stringify(error, null, 2))
                console.error('Error status:', error?.status || error?.response?.status || 'N/A')
                console.error('Error message:', error?.message || error?.response?.data?.error?.message || 'N/A')
                return false
            }
        }
        
        return true
    } catch (error) {
        console.error('❌ Azure OpenAI connection test failed:', error)
        return false
    }
}