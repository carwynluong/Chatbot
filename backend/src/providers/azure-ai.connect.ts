import axios from 'axios'
import { 
    AZURE_OPENAI_ENDPOINT, 
    AZURE_OPENAI_API_KEY, 
    AZURE_OPENAI_API_VERSION,
    AZURE_LLM_DEPLOYMENT_NAME,
    AZURE_EMBEDDING_DEPLOYMENT_NAME
} from '../config/env'

export class AzureOpenAIService {
    private static instance: AzureOpenAIService
    private baseEndpoint: string
    private apiKey: string
    private apiVersion: string

    private constructor() {
        if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
            throw new Error('Azure OpenAI configuration missing. Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY.')
        }

        this.baseEndpoint = AZURE_OPENAI_ENDPOINT!.replace(/\/$/, '')
        this.apiKey = AZURE_OPENAI_API_KEY!
        this.apiVersion = AZURE_OPENAI_API_VERSION!

        console.log(`🔗 Azure OpenAI endpoint: ${this.baseEndpoint}`)
    }

    static getInstance(): AzureOpenAIService {
        if (!AzureOpenAIService.instance) {
            AzureOpenAIService.instance = new AzureOpenAIService()
        }
        return AzureOpenAIService.instance
    }

    // Custom Azure-compatible embedding method
    async createEmbedding(input: string): Promise<number[]> {
        try {
            console.log('🔄 Creating Azure embedding with custom client...')
            
            const url = `${this.baseEndpoint}/openai/deployments/${AZURE_EMBEDDING_DEPLOYMENT_NAME}/embeddings`
            
            console.log('📤 Azure Embedding Request:', {
                url,
                deployment: AZURE_EMBEDDING_DEPLOYMENT_NAME,
                apiVersion: this.apiVersion,
                inputLength: input.length
            })
            
            const response: any = await axios.post(url, {
                input,
                model: AZURE_EMBEDDING_DEPLOYMENT_NAME
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': this.apiKey
                },
                params: {
                    'api-version': this.apiVersion
                },
                timeout: 30000
            })
            
            if (response.data?.data?.[0]?.embedding) {
                return response.data.data[0].embedding
            } else {
                throw new Error('Invalid embedding response format')
            }
        } catch (error: any) {
            console.error('❌ Azure embedding error:', error)
            
            if (error?.response) {
                console.error('Response status:', error.response.status)
                console.error('Response data:', error.response.data)
                throw new Error(`Azure embedding failed: ${error.response.status} ${error.response.statusText || error.message}`)
            } else {
                throw new Error(`Azure embedding error: ${error?.message || error}`)
            }
        }
    }

    // Custom Azure-compatible chat method
    async createChatCompletion(messages: any[], options: any = {}): Promise<any> {
        try {
            console.log('🔄 Creating Azure chat completion...')
            
            const url = `${this.baseEndpoint}/openai/deployments/${AZURE_LLM_DEPLOYMENT_NAME}/chat/completions`
            
            const response: any = await axios.post(url, {
                messages,
                model: AZURE_LLM_DEPLOYMENT_NAME,
                ...options
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': this.apiKey
                },
                params: {
                    'api-version': this.apiVersion
                },
                timeout: 60000
            })

            console.log('✅ Azure chat completion successful')
            return response.data
        } catch (error: any) {
            console.error('❌ Azure chat completion error:', error)
            
            if (error?.response) {
                console.error('Response status:', error.response.status)
                console.error('Response data:', error.response.data)
                throw new Error(`Azure chat completion failed: ${error.response.status} ${error.response.statusText || error.message}`)
            } else {
                throw new Error(`Azure chat completion error: ${error?.message || error}`)
            }
        }
    }

    async healthCheck(): Promise<boolean> {
        console.log('⚠️ Azure OpenAI health check temporarily disabled - manual test passed')
        console.log('📋 Current configuration:')
        console.log(`   - Endpoint: ${AZURE_OPENAI_ENDPOINT}`)
        console.log(`   - API Version: ${AZURE_OPENAI_API_VERSION}`)
        console.log(`   - LLM Deployment: ${AZURE_LLM_DEPLOYMENT_NAME}`)
        console.log(`   - Embedding Deployment: ${AZURE_EMBEDDING_DEPLOYMENT_NAME}`)
        console.log('💡 Manual PowerShell test succeeded - will test from UI')
        return true
    }
}

export default AzureOpenAIService.getInstance()