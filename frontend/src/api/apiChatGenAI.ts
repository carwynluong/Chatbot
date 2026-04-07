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
        try {
            // Chuyển Date thành string
            const messagesForSave = messages.map(msg => ({
                ...msg,
                timestamp: msg.timestamp.toISOString()
            }))
            
            // Backend lấy userId từ auth token, không cần gửi trong body
            const response = await axios.post('/chat/save', {
                messages: messagesForSave,
                sessionId
            })
            
            console.log('✅ Chat saved successfully:', response.data)
        } catch (error) {
            console.error('❌ Error saving chat:', error)
            throw error
        }
    }

    async getChatHistory(userId: string): Promise<ChatHistoryResponse> {
        try {
            // Backend lấy userId từ auth token, không cần parameter
            const res = await axios.get('/chat/history')
            console.log('✅ Chat history retrieved:', res.data)
            return res.data
        } catch (error) {
            console.error('❌ Error getting chat history:', error)
            throw error
        }
    }

    async deleteChatSession(userId: string, sessionId: string): Promise<void> {
        try {
            console.log('API: Deleting session', sessionId, 'for user', userId)
            // Backend lấy userId từ auth token, chỉ cần sessionId
            const response = await axios.delete(`/chat/delete/${sessionId}`)
            console.log('API: Delete successful', response.data)
            return response.data
        } catch (error) {
            console.error('API: Delete failed', error)
            throw error
        }
    }
}

export default new ChatAPI()