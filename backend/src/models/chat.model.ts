export interface ChatMessage {
    id: string
    content: string
    isUser: boolean
    timestamp: string
}

export interface ChatSession {
    userId: string
    timestamp: number
    messages: ChatMessage[]
    createdAt: string
    updatedAt: string
}