export interface Message {
    id: string
    content: string
    isUser: boolean
    timestamp: Date
}


export interface ChatHistoryResponse {
    success: boolean
    statusCode: number
    message: string
    data: {
        history: Array<{
            userId: string
            messages: Message[]
            createdAt: string
            updatedAt: string
            timestamp: number
            sessionId?: string
        }>
        count?: number
    }
    timestamp?: string
}