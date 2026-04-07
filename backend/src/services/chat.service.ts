import { IAIStrategy, IVectorStorageStrategy } from '../interfaces/IStrategy'
import { ChatRepository } from '../repositories/chat.repository'
import { AzureOpenAIStrategy } from '../strategies/azure-openai.strategy'
import { PineconeStorageStrategy } from '../strategies/storage.strategies'
import { ChatCommand } from '../utils/commands'
import { eventManager } from '../utils/event.manager'
import { ChatMessage, ChatSession } from '../models/chat.model'
import { ErrorFactory } from '../utils/pattern.factories'

export class ChatService {
    private aiStrategy: IAIStrategy
    private vectorStorage: IVectorStorageStrategy
    private chatRepository: ChatRepository
    private errorFactory: ErrorFactory

    constructor() {
        this.aiStrategy = new AzureOpenAIStrategy()
        this.vectorStorage = new PineconeStorageStrategy()
        this.chatRepository = new ChatRepository()
        this.errorFactory = new ErrorFactory()
    }

    async *queryWithContext(question: string): AsyncIterable<string> {
        try {
            await eventManager.notify('chat.message.sent', { 
                question: question.substring(0, 100) + (question.length > 100 ? '...' : '')
            })

            // Create chat command and execute streaming
            const chatCommand = new ChatCommand(
                question,
                this.aiStrategy,
                this.vectorStorage
            )

            let responseLength = 0
            for await (const chunk of chatCommand.executeStream()) {
                responseLength += chunk.length
                yield chunk
            }

            await eventManager.notify('chat.message.received', { 
                responseLength 
            })

        } catch (error) {
            console.error('❌ Error in RAG processing:', error)
            
            // Fallback to direct AI response
            try {
                console.log('🚀 Falling back to direct AI chat')
                const fallbackPrompt = `Bạn là một AI assistant thông minh và hữu ích. Trả lời câu hỏi sau:\n\n${question}`
                
                for await (const chunk of this.aiStrategy.streamResponse(fallbackPrompt)) {
                    yield chunk
                }
            } catch (fallbackError) {
                console.error('❌ Fallback also failed:', fallbackError)
                yield `Xin lỗi, đã xảy ra lỗi khi xử lý câu hỏi của bạn: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
        }
    }

    async saveChatSession(userId: string, messages: ChatMessage[], sessionId?: string): Promise<void> {
        try {
            const finalSessionId = sessionId || `session_${Date.now()}`
            
            // Check if session already exists
            const existingSession = await this.chatRepository.findByUserAndSessionId(userId, finalSessionId)
            
            if (existingSession) {
                // Update existing session with new messages
                const sessionKey = `${userId}:${existingSession.timestamp}`
                await this.chatRepository.update(sessionKey, {
                    messages: messages,
                    sessionId: finalSessionId
                })
            } else {
                // Create new session
                await this.chatRepository.create({
                    userId,
                    messages, 
                    sessionId: finalSessionId
                })
            }

            await eventManager.notify('chat.session.saved', { 
                sessionId: finalSessionId,
                userId,
                isUpdate: !!existingSession
            })

        } catch (error) {
            console.error('Error saving chat session:', error)
            throw this.errorFactory.createInternalError('Failed to save chat session', error as Error)
        }
    }

    async getChatHistory(userId: string): Promise<ChatSession[]> {
        try {
            return await this.chatRepository.findByUser(userId)
        } catch (error) {
            console.error('❌ Error fetching chat history:', error)
            throw this.errorFactory.createInternalError('Failed to fetch chat history', error as Error)
        }
    }

    async deleteChatSession(userId: string, sessionId: string): Promise<void> {
        try {
            await this.chatRepository.deleteSession(userId, sessionId)

            await eventManager.notify('chat.session.deleted', { 
                sessionId,
                userId
            })

        } catch (error) {
            console.error(`Error deleting session ${sessionId}:`, error)
            throw this.errorFactory.createInternalError('Failed to delete chat session', error as Error)
        }
    }

    async findSessionBySessionId(userId: string, sessionId: string): Promise<ChatSession | null> {
        try {
            return await this.chatRepository.findByUserAndSessionId(userId, sessionId)
        } catch (error) {
            console.error('❌ Error finding session:', error)
            return null
        }
    }

    // Additional helper methods
    
    async getSessionCount(userId: string): Promise<number> {
        try {
            const sessions = await this.chatRepository.findByUser(userId)
            return sessions.length
        } catch (error) {
            console.error('❌ Error getting session count:', error)
            return 0
        }
    }

    async clearAllSessions(userId: string): Promise<void> {
        try {
            const sessions = await this.chatRepository.findByUser(userId)
            
            for (const session of sessions) {
                await this.chatRepository.delete(`${session.userId}:${session.timestamp}`)
            }

            console.log(`🗑️ Cleared all sessions for user: ${userId}`)
        } catch (error) {
            console.error('❌ Error clearing sessions:', error)
            throw this.errorFactory.createInternalError('Failed to clear chat sessions', error as Error)
        }
    }

    // Strategy pattern support - allow runtime strategy switching
    
    setAIStrategy(strategy: IAIStrategy): void {
        this.aiStrategy = strategy
        console.log('🔄 AI strategy updated')
    }

    setVectorStorage(storage: IVectorStorageStrategy): void {
        this.vectorStorage = storage
        console.log('🔄 Vector storage strategy updated')
    }
}

export default new ChatService()
