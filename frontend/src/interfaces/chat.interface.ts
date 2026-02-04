export interface Message {
    id: string
    content: string
    isUser: boolean
    timestamp: Date
}


export interface ChatHistoryResponse {
    message: string
    history: Array<{
        userId: string
        messages: Message[]
        createdAt: string
        updatedAt: string
        timestamp: number
    }>
}