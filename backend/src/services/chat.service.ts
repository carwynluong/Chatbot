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
            // console.log('Generating embedding for user question...')
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
            
            // Tăng số lượng chunks để capture nhiều thông tin hơn từ tất cả files
            const similarDocuments = await embeddingService.querySimilarDocuments(
                queryEmbedding, 
                10  // Tăng lên 10 chunks để có thể lấy thông tin từ nhiều files
            )
            
            console.log(`📚 Found ${similarDocuments.length} similar documents`)
            
            // Group by document để đảm bảo có thông tin từ nhiều files khác nhau
            const documentGroups = new Map()
            similarDocuments.forEach(match => {
                const docId = match.metadata?.documentId
                if (docId) {
                    if (!documentGroups.has(docId)) {
                        documentGroups.set(docId, [])
                    }
                    documentGroups.get(docId).push(match)
                }
            })
            
            console.log(`📁 Content found in ${documentGroups.size} different documents:`)
            documentGroups.forEach((matches, docId) => {
                console.log(`  - ${docId}: ${matches.length} chunks`)
            })
            
            const results = similarDocuments.map(match => ({
                score: match.score,
                metadata: match.metadata
            }))
            
            console.log(`🎯 Returning ${results.length} processed results from ${documentGroups.size} documents`)
            return results
            
        } catch (error) {
            console.error('❌ Error finding similar chunks:', error)
            return [] // Return empty array if query fails
        }
    }

    private buildPrompt(question: string, context: string): string {
        // Extract file names from context to show sources
        const fileNames = new Set<string>()
        const contextLines = context.split('\n\n')
        
        // Try to extract file info from metadata if available
        contextLines.forEach(line => {
            // This is a simple heuristic - in a real implementation you might pass file info separately
            if (line.includes('uploads/')) {
                const match = line.match(/uploads\/[^/]*\.([a-zA-Z]+)/)
                if (match) {
                    fileNames.add(match[0].split('/').pop() || 'unknown file')
                }
            }
        })
        
        return `Bạn là một AI assistant thông minh và hữu ích. Hãy trả lời câu hỏi dựa trên thông tin được cung cấp trong phần Context từ các tài liệu đã upload.

**Context từ các tài liệu đã upload:**
${context}

${fileNames.size > 0 ? `**Nguồn thông tin từ ${fileNames.size} file(s): ${Array.from(fileNames).join(', ')}**\n` : ''}

**Câu hỏi:** ${question}

**Hướng dẫn:**
- Trả lời chính xác và chi tiết dựa trên thông tin trong Context ở trên
- Nếu thông tin trải rộng trên nhiều tài liệu, hãy tổng hợp và trình bày một cách có hệ thống
- Có thể trích dẫn thông tin cụ thể từ context khi cần thiết  
- Nếu thông tin trong Context không đủ để trả lời hoàn toàn, hãy nói rõ điều đó và trả lời dựa trên những gì có
- Trả lời bằng tiếng Việt một cách tự nhiên, rõ ràng và dễ hiểu
- Nếu câu hỏi liên quan đến danh sách, số liệu cụ thể, thông tin chi tiết từ tài liệu thì ưu tiên sử dụng chính xác thông tin từ Context`
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
