import { Request, Response } from 'express'
import { ChatService } from '../services/chat.service'
import statusCodes from '../constants/statusCodes'

const chatService = new ChatService()

export class ChatController {
    async chatWithDocuments(req: Request, res: Response) {
        try {
            const { question } = req.body

            if (!question) {
                return res.status(statusCodes.BAD_REQUEST).json({
                    message: 'Question is required'
                })
            }
            res.setHeader('Content-Type', 'text/plain')
            res.setHeader('Transfer-Encoding', 'chunked')

            // Stream response
            let hasContent = false

            try {
                // Stream response
                for await (const chunk of chatService.queryWithContext(question)) {
                    hasContent = true
                    res.write(chunk)
                }
            } catch (streamError) {
                console.error('Streaming error:', streamError)
                if (!hasContent) {
                    res.write('Error occurred while processing your request.')
                }
            }
            res.end()
        } catch (error) {
            console.error('Error in chat:', error)
            res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to process query'
            })
        }
    }

    async saveChat(req: Request, res: Response) {
        try {
            const { messages } = req.body
            const userId = (req as any).user?.id

            await chatService.saveChatSession(userId, messages)
            res.status(statusCodes.OK).json({
                message: 'Chat saved successfully'
            })
        } catch (error) {
            console.error('Error in saveChat:', error)
            res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to save chat'
            })
        }
    }
    async getChatHistory(req: Request, res: Response) {
        try {
            const { userId } = req.params
            const history = await chatService.getChatHistory(userId)
            res.status(statusCodes.OK).json({
                message: 'Chat history retrieved successfully',
                history
            })
        } catch (error) {
            res.status(500).json({ error: 'Failed to get chat history' })
        }
    }
}


export default new ChatController()