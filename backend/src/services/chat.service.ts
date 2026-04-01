import embeddingService from "./embedding.service"
import {
    MAX_TOKEN, TEMPERATURE, TOP_P, CHAT_TABLE_NAME,
    AZURE_LLM_DEPLOYMENT_NAME
} from "../config/env"
import azureClient from "../providers/azure-ai.connect"
import { ChatMessage, ChatSession } from "../models/chat.model"
import { dynamoClient } from "../providers/dynamodb.connect"
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"

export class ChatService {
    async *queryWithContext(question: string): AsyncIterable<string> {
        try {
            console.log('🔍 Generating embedding for user question...')
            const questionEmbedding = await embeddingService.generateEmbedding(question)
            
            console.log('📚 Searching for similar document chunks...')
            const similarChunks = await this.findSimilarChunks(questionEmbedding)
            
            if (similarChunks.length > 0) {
                console.log(`✅ Found ${similarChunks.length} relevant document chunks`)
                const context = similarChunks.map(chunk => chunk.metadata?.content || '').join('\n\n')
                const prompt = this.buildPrompt(question, context)
                yield* this.invokeGPTStream(prompt)
            } else {
                console.log('ℹ️  No relevant documents found, answering with general knowledge')
                const prompt = `Bạn là một AI assistant thông minh và hữu ích. Trả lời câu hỏi sau:\n\n${question}`
                yield* this.invokeGPTStream(prompt)
            }
        } catch (error) {
            console.error('❌ Error in RAG processing:', error)
            console.log('🚀 Falling back to direct GPT chat')
            const prompt = `Bạn là một AI assistant thông minh và hữu ích. Trả lời câu hỏi sau:\n\n${question}`
            yield* this.invokeGPTStream(prompt)
        }
    }

    async saveChatSession(userId: string, messages: ChatMessage[]): Promise<void> {
        const timestamp = Date.now()
        const now = new Date().toISOString()
        const command = {
            TableName: CHAT_TABLE_NAME,
            Item: {
                userId,
                timestamp,
                messages,
                createdAt: now,
                updatedAt: now
            }
        }
        await dynamoClient.send(new PutCommand(command))
    }

    async getChatHistory(userId: string): Promise<ChatSession[]> {
        const command = {
            TableName: CHAT_TABLE_NAME,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        }
        const result = await dynamoClient.send(new QueryCommand(command))
        // console.log('Get message', result.Items)
        return result.Items as ChatSession[] || []
    }

    private async findSimilarChunks(queryEmbedding: number[]) {
        try {
            // Use the embedding service to query Pinecone
            const similarDocuments = await embeddingService.querySimilarDocuments(
                queryEmbedding, 
                5  // Top 5 similar chunks
            )
            
            return similarDocuments.map(match => ({
                score: match.score,
                metadata: match.metadata
            }))
        } catch (error) {
            console.error('Error finding similar chunks:', error)
            return [] // Return empty array if query fails
        }
    }

    private buildPrompt(question: string, context: string): string {
        return `Bạn là một AI assistant thông minh và hữu ích. Hãy trả lời câu hỏi dựa trên thông tin được cung cấp trong phần Context.

**Context:**
${context}

**Câu hỏi:** ${question}

**Hướng dẫn:**
- Trả lời chính xác dựa trên thông tin trong Context
- Nếu không có thông tin liên quan trong Context, hãy nói rõ điều đó
- Trả lời bằng tiếng Việt một cách tự nhiên và dễ hiểu`
    }





    private async *invokeGPTStream(prompt: string): AsyncIterable<string> {
        try {
            if (!AZURE_LLM_DEPLOYMENT_NAME) {
                throw new Error('AZURE_LLM_DEPLOYMENT_NAME is not configured')
            }

            const messages = [
                {
                    role: "system" as const,
                    content: "Bạn là một AI assistant thông minh, chuyên nghiệp và hữu ích. Luôn trả lời chính xác, chi tiết và bằng tiếng Việt."
                },
                {
                    role: "user" as const,
                    content: prompt
                }
            ]

            const stream = await azureClient.chat.completions.create({
                model: AZURE_LLM_DEPLOYMENT_NAME!,
                messages: messages,
                max_completion_tokens: parseInt(MAX_TOKEN!) || 4000,
                temperature: parseFloat(TEMPERATURE!) || 0.7,
                top_p: parseFloat(TOP_P!) || 0.9,
                stream: true
            })

            for await (const chunk of stream) {
                const content = chunk.choices?.[0]?.delta?.content
                if (content) {
                    yield content
                }
            }
            
            console.log('GPT-4 stream completed')
        } catch (error) {
            console.error('GPT-4 stream error:', error)
            yield 'Xin lỗi, đã xảy ra lỗi khi tạo phản hồi. Vui lòng thử lại.'
        }
    }
}
