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

    async saveChatHistory(userId: string, messages: Message[]): Promise<void> {
        // Chuyển Date thành string
        const messagesForSave = messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp.toISOString()
        }))
        await axios.post('/chat/save', {
            userId,
            messages: messagesForSave
        })
    }

    async getChatHistory(userId: string): Promise<ChatHistoryResponse> {
        const res = await axios.get(`/chat/history/${userId}`)
        return res.data
    }
}

export default new ChatAPI()