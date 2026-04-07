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
            const response = await azureService.getClient().chat.completions.create({
                model: AZURE_LLM_DEPLOYMENT_NAME!,
                messages: [{ role: 'user', content: prompt }],
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
            const response = await azureService.getClient().embeddings.create({
                model: AZURE_EMBEDDING_DEPLOYMENT_NAME!,
                input: text
            })

            return response.data[0].embedding
        } catch (error) {
            console.error('Azure OpenAI embedding error:', error)
            throw new Error(`Failed to generate embedding: ${error}`)
        }
    }

    async *streamResponse(prompt: string): AsyncIterable<string> {
        try {
            const stream = await azureService.getClient().chat.completions.create({
                model: AZURE_LLM_DEPLOYMENT_NAME!,
                messages: [{ role: 'user', content: prompt }],
                max_completion_tokens: parseInt(MAX_TOKEN!) || 4000,
                temperature: parseFloat(TEMPERATURE!) || 0.7,
                stream: true
            })

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content
                if (content) {
                    yield content
                }
            }
        } catch (error) {
            console.error('Azure OpenAI streaming error:', error)
            yield `Error occurred while streaming response: ${error}`
        }
    }
}