import OpenAI from 'openai'
import { 
    AZURE_OPENAI_ENDPOINT, 
    AZURE_OPENAI_API_KEY, 
    AZURE_OPENAI_API_VERSION,
    AZURE_LLM_DEPLOYMENT_NAME,
    AZURE_EMBEDDING_DEPLOYMENT_NAME
} from '../config/env'

export class AzureOpenAIService {
    private static instance: AzureOpenAIService
    private client: OpenAI

    private constructor() {
        if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
            throw new Error('Azure OpenAI configuration missing. Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY.')
        }

        this.client = new OpenAI({
            apiKey: AZURE_OPENAI_API_KEY!,
            baseURL: `${AZURE_OPENAI_ENDPOINT!.replace(/\/$/, '')}/openai/deployments`,
            defaultQuery: { 'api-version': AZURE_OPENAI_API_VERSION! }
        })
    }

    static getInstance(): AzureOpenAIService {
        if (!AzureOpenAIService.instance) {
            AzureOpenAIService.instance = new AzureOpenAIService()
        }
        return AzureOpenAIService.instance
    }

    getClient(): OpenAI {
        return this.client
    }

    async healthCheck(): Promise<boolean> {
        try {
            // Test LLM deployment if available
            if (AZURE_LLM_DEPLOYMENT_NAME) {
                await this.client.chat.completions.create({
                    model: AZURE_LLM_DEPLOYMENT_NAME,
                    messages: [{ 
                        role: "user", 
                        content: "Test connection" 
                    }],
                    max_tokens: 10,
                    temperature: 0.1
                })
            }
            
            // Test Embedding deployment if available
            if (AZURE_EMBEDDING_DEPLOYMENT_NAME) {
                await this.client.embeddings.create({
                    model: AZURE_EMBEDDING_DEPLOYMENT_NAME,
                    input: "test embedding"
                })
            }
            
            return true
        } catch (error) {
            console.error('❌ Azure OpenAI connection failed:', error)
            return false
        }
    }
}

export default AzureOpenAIService.getInstance()