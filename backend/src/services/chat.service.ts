import embeddingService from "./embedding.service"
import {
    MAX_TOKEN, TEMPERATURE, TOP_P, CHAT_TABLE_NAME,
    AZURE_LLM_DEPLOYMENT_NAME
} from "../config/env"
import azureClient from "../providers/azure-ai.connect"
import { ChatMessage, ChatSession } from "../models/chat.model"
import { dynamoClient } from "../providers/dynamodb.connect"
import { PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb"

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
                console.log(`📝 Built context with ${context.length} characters`)
                console.log(`📄 Context preview: "${context.substring(0, 200)}..."`)
                
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

    async saveChatSession(userId: string, messages: ChatMessage[], sessionId?: string): Promise<void> {
        const now = new Date().toISOString()
        
        if (sessionId) {
            // Tìm session hiện tại để update
            const existingSession = await this.findSessionBySessionId(userId, sessionId)
            
            if (existingSession) {
                // Update session hiện tại
                const command = {
                    TableName: CHAT_TABLE_NAME,
                    Item: {
                        userId,
                        timestamp: existingSession.timestamp, // Giữ nguyên timestamp cũ
                        sessionId,
                        messages,
                        createdAt: existingSession.createdAt,
                        updatedAt: now
                    }
                }
                await dynamoClient.send(new PutCommand(command))
                return
            }
        }
        
        // Tạo session mới
        const timestamp = Date.now()
        const newSessionId = sessionId || `session-${timestamp}`
        const command = {
            TableName: CHAT_TABLE_NAME,
            Item: {
                userId,
                timestamp,
                sessionId: newSessionId,
                messages,
                createdAt: now,
                updatedAt: now
            }
        }
        await dynamoClient.send(new PutCommand(command))
    }

    private async findSessionBySessionId(userId: string, sessionId: string): Promise<ChatSession | null> {
        try {
            const command = {
                TableName: CHAT_TABLE_NAME,
                KeyConditionExpression: 'userId = :userId',
                FilterExpression: 'sessionId = :sessionId',
                ExpressionAttributeValues: {
                    ':userId': userId,
                    ':sessionId': sessionId
                }
            }
            const result = await dynamoClient.send(new QueryCommand(command))
            return result.Items && result.Items.length > 0 ? result.Items[0] as ChatSession : null
        } catch (error) {
            console.error('Error finding session:', error)
            return null
        }
    }

    async getChatHistory(userId: string): Promise<ChatSession[]> {
        const command = {
            TableName: CHAT_TABLE_NAME,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            },
            ScanIndexForward: false  // Sort descending by timestamp (newest first)
        }
        const result = await dynamoClient.send(new QueryCommand(command))
        return result.Items as ChatSession[] || []
    }

    async deleteChatSession(userId: string, sessionId: string): Promise<void> {
        try {
            console.log('Service: Finding session to delete for user:', userId, 'session:', sessionId)
            
            // Tìm session cần xóa
            const sessionToDelete = await this.findSessionBySessionId(userId, sessionId)
            
            if (sessionToDelete) {
                console.log('Service: Session found, deleting...', { 
                    userId, 
                    sessionId, 
                    timestamp: sessionToDelete.timestamp 
                })
                
                const command = {
                    TableName: CHAT_TABLE_NAME,
                    Key: {
                        userId: userId,
                        timestamp: sessionToDelete.timestamp
                    }
                }
                await dynamoClient.send(new DeleteCommand(command))
                console.log('Service: Session deleted successfully')
            } else {
                console.log('Service: Session not found to delete')
            }
        } catch (error) {
            console.error('Error deleting chat session:', error)
            throw error
        }
    }

    private async findSimilarChunks(queryEmbedding: number[]) {
        try {
            console.log(`🔍 Finding similar chunks, embedding dimensions: ${queryEmbedding.length}`)
            
            // Use the embedding service to query Pinecone
            const similarDocuments = await embeddingService.querySimilarDocuments(
                queryEmbedding, 
                5  // Top 5 similar chunks
            )
            
            console.log(`📚 Found ${similarDocuments.length} similar documents`)
            
            const results = similarDocuments.map(match => ({
                score: match.score,
                metadata: match.metadata
            }))
            
            console.log(`🎯 Returning ${results.length} processed results`)
            return results
            
        } catch (error) {
            console.error('❌ Error finding similar chunks:', error)
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
