import { Request, Response } from 'express'
import chatService from '../services/chat.service'
import { ResponseBuilder } from '../utils/builders'
import { ErrorFactory } from '../utils/pattern.factories'
import statusCodes from '../constants/statusCodes'

export class ChatController {
    private chatService: typeof chatService
    private errorFactory: ErrorFactory

    constructor() {
        this.chatService = chatService
        this.errorFactory = new ErrorFactory()
    }

    async chatWithDocuments(req: Request, res: Response) {
        try {
            const { question } = req.body

            if (!question) {
                return ResponseBuilder.validation('Question is required')
                    .send(res)
            }

            // Set headers for streaming
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.setHeader('Transfer-Encoding', 'chunked')
            res.setHeader('Cache-Control', 'no-cache')
            res.setHeader('Connection', 'keep-alive')

            let hasContent = false
            let totalResponseLength = 0

            try {
                // Stream the AI response
                for await (const chunk of this.chatService.queryWithContext(question)) {
                    hasContent = true
                    totalResponseLength += chunk.length
                    res.write(chunk)
                }

                // Log successful completion
                console.log(`✅ Chat response completed: ${totalResponseLength} characters`)

            } catch (streamError) {
                console.error('❌ Streaming error:', streamError)
                
                if (!hasContent) {
                    res.write('Xin lỗi, đặt xảy ra lỗi khi xử lý câu hỏi của bạn. Vui lòng thử lại sau.')
                }
            } finally {
                res.end()
            }

        } catch (error) {
            console.error('❌ Error in chat controller:', error)
            
            // If response hasn't started, send error response
            if (!res.headersSent) {
                ResponseBuilder.error('Failed to process query')
                    .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
                    .send(res)
            }
        }
    }

    async saveChat(req: Request, res: Response) {
        try {
            const { messages, sessionId } = req.body
            const userId = (req as any).user?.id

            if (!userId) {
                return ResponseBuilder.unauthorized('User not authenticated')
                    .send(res)
            }

            if (!messages || !Array.isArray(messages)) {
                return ResponseBuilder.validation('Messages array is required')
                    .send(res)
            }

            // Save chat session
            await this.chatService.saveChatSession(userId, messages, sessionId)

            ResponseBuilder.success(
                { sessionId: sessionId || 'new' }, 
                'Chat saved successfully'
            ).send(res)

        } catch (error) {
            console.error('❌ Error saving chat:', error)
            
            if ((error as any).name === 'NotFoundError') {
                ResponseBuilder.notFound('Chat session', (error as any).id)
                    .send(res)
            } else {
                ResponseBuilder.error('Failed to save chat')
                    .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
                    .send(res)
            }
        }
    }

    async getChatHistory(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id

            if (!userId) {
                return ResponseBuilder.unauthorized('User not authenticated')
                    .send(res)
            }

            // Get chat history
            const history = await this.chatService.getChatHistory(userId)

            ResponseBuilder.success({
                history: history,
                count: history.length
            }, 'Chat history retrieved successfully')
                .send(res)

        } catch (error) {
            console.error('❌ Error fetching chat history:', error)
            
            ResponseBuilder.error('Failed to fetch chat history')
                .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
                .send(res)
        }
    }

    async deleteChatSession(req: Request, res: Response) {
        try {
            const { sessionId } = req.params
            const userId = (req as any).user?.id

            if (!userId) {
                return ResponseBuilder.unauthorized('User not authenticated')
                    .send(res)
            }

            if (!sessionId) {
                return ResponseBuilder.validation('Session ID is required')
                    .send(res)
            }

            // Delete chat session
            await this.chatService.deleteChatSession(userId, sessionId)

            ResponseBuilder.success(
                { sessionId }, 
                'Chat session deleted successfully'
            ).send(res)

        } catch (error) {
            console.error('❌ Error deleting chat session:', error)
            
            ResponseBuilder.error('Failed to delete chat session')
                .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
                .send(res)
        }
    }

    async getChatSession(req: Request, res: Response) {
        try {
            const { sessionId } = req.params
            const userId = (req as any).user?.id

            if (!userId) {
                return ResponseBuilder.unauthorized('User not authenticated')
                    .send(res)
            }

            if (!sessionId) {
                return ResponseBuilder.validation('Session ID is required')
                    .send(res)
            }

            // Find chat session
            const session = await this.chatService.findSessionBySessionId(userId, sessionId)

            if (!session) {
                return ResponseBuilder.notFound('Chat session', sessionId)
                    .send(res)
            }

            ResponseBuilder.success(session, 'Chat session retrieved successfully')
                .send(res)

        } catch (error) {
            console.error('❌ Error fetching chat session:', error)
            
            ResponseBuilder.error('Failed to fetch chat session')
                .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
                .send(res)
        }
    }

    async getSessionsCount(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id

            if (!userId) {
                return ResponseBuilder.unauthorized('User not authenticated')
                    .send(res)
            }

            // Get session count
            const count = await this.chatService.getSessionCount(userId)

            ResponseBuilder.success(
                { count }, 
                'Session count retrieved successfully'
            ).send(res)

        } catch (error) {
            console.error('❌ Error getting session count:', error)
            
            ResponseBuilder.error('Failed to get session count')
                .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
                .send(res)
        }
    }

    async clearAllSessions(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id

            if (!userId) {
                return ResponseBuilder.unauthorized('User not authenticated')
                    .send(res)
            }

            // Clear all sessions
            await this.chatService.clearAllSessions(userId)

            ResponseBuilder.success(
                null, 
                'All chat sessions cleared successfully'
            ).send(res)

        } catch (error) {
            console.error('❌ Error clearing sessions:', error)
            
            ResponseBuilder.error('Failed to clear chat sessions')
                .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
                .send(res)
        }
    }
}

export default new ChatController()