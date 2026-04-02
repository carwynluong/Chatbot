import axios from '../lib/axios'
import type { Message, ChatHistoryResponse } from '../interfaces'

export class ChatAPI {
    async sendQuestion(question: string): Promise<string> {
        try {
            const res = await axios.post('/chat', {
                question
            })
            return res.data
        } catch (error) {
            return 'Error'
        }
    }

    async saveChatHistory(userId: string, messages: Message[], sessionId?: string): Promise<void> {
        // Chuyển Date thành string
        const messagesForSave = messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp.toISOString()
        }))
        await axios.post('/chat/save', {
            userId,
            messages: messagesForSave,
            sessionId
        })
    }

    async getChatHistory(userId: string): Promise<ChatHistoryResponse> {
        const res = await axios.get(`/chat/history/${userId}`)
        return res.data
    }

    async deleteChatSession(userId: string, sessionId: string): Promise<void> {
        try {
            console.log('API: Deleting session', sessionId, 'for user', userId)
            const response = await axios.delete(`/chat/delete/${userId}/${sessionId}`)
            console.log('API: Delete successful', response.data)
            return response.data
        } catch (error) {
            console.error('API: Delete failed', error)
            throw error
        }
    }
}

export default new ChatAPI()