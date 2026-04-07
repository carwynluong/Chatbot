import { IAIStrategy } from "../interfaces/IStrategy"
import azureService from "../providers/azure-ai.connect"
import { 
    AZURE_LLM_DEPLOYMENT_NAME, 
    AZURE_EMBEDDING_DEPLOYMENT_NAME, 
    MAX_TOKEN, 
    TEMPERATURE 
} from "../config/env"

export class AzureOpenAIStrategy implements IAIStrategy {
    async generateResponse(prompt: string): Promise<string> {
        try {
            // Use custom Azure-compatible chat method
            const response = await azureService.createChatCompletion([
                { role: 'user', content: prompt }
            ], {
                max_completion_tokens: parseInt(MAX_TOKEN!) || 4000,
                temperature: parseFloat(TEMPERATURE!) || 0.7,
                stream: false
            })

            return response.choices[0]?.message?.content || 'No response generated'
        } catch (error) {
            console.error('Azure OpenAI response error:', error)
            throw new Error(`Failed to generate response: ${error}`)
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        try {
            console.log(`🔄 Generating embedding for text length: ${text.length}`)
            console.log(`📀 Using deployment: ${AZURE_EMBEDDING_DEPLOYMENT_NAME}`)
            
            // Use custom Azure-compatible embedding method
            const embedding = await azureService.createEmbedding(text)
            
            console.log(`✅ Embedding generated successfully, dimension: ${embedding.length}`)
            return embedding
            
        } catch (error) {
            console.error('❌ Azure OpenAI embedding error details:')
            console.error('   Deployment:', AZURE_EMBEDDING_DEPLOYMENT_NAME)
            console.error('   Text length:', text.length)
            console.error('   Error:', error)
            console.error('   Error message:', error instanceof Error ? error.message : 'Unknown error')
            throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : error}`)
        }
    }

    async *streamResponse(prompt: string): AsyncIterable<string> {
        try {
            // Use non-streaming for now since custom Azure client is more reliable
            console.log('🔄 Using non-streaming response for compatibility...')
            const response = await azureService.createChatCompletion([
                { role: 'user', content: prompt }
            ], {
                max_completion_tokens: parseInt(MAX_TOKEN!) || 4000,
                temperature: parseFloat(TEMPERATURE!) || 0.7,
                stream: false
            })

            const content = response.choices[0]?.message?.content || 'No response generated'
            
            // Simulate streaming by yielding chunks
            const words = content.split(' ')
            for (const word of words) {
                yield word + ' '
                // Small delay to simulate streaming
                await new Promise(resolve => setTimeout(resolve, 50))
            }
            
        } catch (error) {
            console.error('Azure OpenAI streaming error:', error)
            yield `Error occurred while streaming response: ${error}`
        }
    }
}