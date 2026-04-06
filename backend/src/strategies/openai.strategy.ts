import { IAIStrategy } from "../interfaces/IStrategy"
import OpenAI from "openai"

export class OpenAIStrategy implements IAIStrategy {
    private client: OpenAI

    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY not found in environment variables')
        }
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        })
    }

    async generateResponse(prompt: string): Promise<string> {
        try {
            const response = await this.client.chat.completions.create({
                model: 'gpt-4',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 4000,
                temperature: 0.7,
                stream: false
            })

            return response.choices[0]?.message?.content || 'No response generated'
        } catch (error) {
            console.error('OpenAI response error:', error)
            throw new Error(`Failed to generate response: ${error}`)
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        try {
            const response = await this.client.embeddings.create({
                model: 'text-embedding-ada-002',
                input: text
            })

            return response.data[0].embedding
        } catch (error) {
            console.error('OpenAI embedding error:', error)
            throw new Error(`Failed to generate embedding: ${error}`)
        }
    }

    async *streamResponse(prompt: string): AsyncIterable<string> {
        try {
            const stream = await this.client.chat.completions.create({
                model: 'gpt-4',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 4000,
                temperature: 0.7,
                stream: true
            })

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content
                if (content) {
                    yield content
                }
            }
        } catch (error) {
            console.error('OpenAI streaming error:', error)
            yield `Error occurred while streaming response: ${error}`
        }
    }
}