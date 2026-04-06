import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../api/apiUserGenAI'
import type { Message } from '../interfaces'
import ChatAPI from '../api/apiChatGenAI'

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const { user } = useAuth()
    const [searchParams] = useSearchParams()
    
    const chatId = searchParams.get('chat')
    const isNewChat = searchParams.get('new') === 'true'

    useEffect(() => {
        if (!user?.id) return
        
        // If it's a new chat, start with empty messages
        if (isNewChat) {
            setMessages([])
            // Generate new sessionId for new chat
            const newSessionId = `session-${Date.now()}`
            setCurrentChatId(newSessionId)
            return
        }
        
        // If specific chat ID is provided, try to load that session
        if (chatId && chatId !== currentChatId) {
            ChatAPI.getChatHistory(user.id).then((response) => {
                // Fix: Access history from response.data.history
                if (response.data && response.data.history && response.data.history.length > 0) {
                    const targetSession = response.data.history.find((session: any, index: number) => {
                        // Try multiple ways to match session
                        return session.sessionId === chatId || 
                               `session-${index}` === chatId ||
                               session.timestamp?.toString() === chatId
                    })
                    
                    if (targetSession) {
                        console.log('\u2705 Found target session:', targetSession.sessionId || chatId)
                        const messagesWithDate = targetSession.messages.map((msg: any) => ({
                            ...msg,
                            timestamp: new Date(msg.timestamp)
                        }))
                        setMessages(messagesWithDate)
                        setCurrentChatId(chatId)
                    } else {
                        console.log('❌ Session not found:', chatId)
                        // Session not found, start new chat
                        setMessages([])
                        setCurrentChatId(chatId)
                    }
                } else {
                    setMessages([])
                    setCurrentChatId(chatId)
                }
            }).catch((error) => {
                console.error('Failed to load chat session:', error)
                setMessages([])
                setCurrentChatId(chatId)
            })
        } else if (!chatId && !currentChatId) {
            // No specific chat ID, load latest session (default behavior)
            ChatAPI.getChatHistory(user.id).then((response) => {
                // Fix: Access history from response.data.history
                if (response.data && response.data.history && response.data.history.length > 0) {
                    const latestSession = response.data.history.reduce((latest, current) => 
                        current.timestamp > latest.timestamp ? current : latest
                    )
                    
                    const messagesWithDate = latestSession.messages.map((msg: any) => ({
                        ...msg,
                        timestamp: new Date(msg.timestamp)
                    }))
                    setMessages(messagesWithDate)
                    setCurrentChatId(latestSession.sessionId || `session-${latestSession.timestamp}`)
                } else {
                    // No history found, start fresh with new session
                    setMessages([])
                    const newSessionId = `session-${Date.now()}`
                    setCurrentChatId(newSessionId)
                }
            }).catch(() => {
                setMessages([])
                const newSessionId = `session-${Date.now()}`
                setCurrentChatId(newSessionId)
            })
        }
    }, [user, chatId, isNewChat, currentChatId])

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim()) return

        const userMessage: Message = {
            id: Date.now().toString(),
            content: input,
            isUser: true,
            timestamp: new Date()
        }
        const newMessages = [...messages, userMessage]
        setMessages(newMessages)
        setInput('')
        setIsLoading(true)

        try {
            const response = await ChatAPI.sendQuestion(input)

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                content: response || 'Không có phản hồi',
                isUser: false,
                timestamp: new Date()
            }
            const finalMessages = [...newMessages, aiMessage]

            setMessages(finalMessages)

            if (user?.id) {
                // Generate sessionId nếu chưa có (new chat)
                let sessionId = currentChatId
                if (!sessionId) {
                    sessionId = `session-${Date.now()}`
                    setCurrentChatId(sessionId)
                }
                // Save với sessionId để maintain cùng 1 session
                ChatAPI.saveChatHistory(user.id, finalMessages, sessionId)
            }
        } catch (error) {
            console.log('Chat error:', error)
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                content: 'Có lỗi xảy ra khi gửi tin nhắn',
                isUser: false,
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setIsLoading(false)
        }
    }

    if (!user) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Chào mừng đến với AI ChatBot</h2>
                    <p className="text-gray-600 mb-6">Vui lòng đăng nhập để bắt đầu trò chuyện</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <h1 className="text-xl font-semibold text-gray-900">AI ChatBot</h1>
                <p className="text-sm text-gray-500">Trò chuyện thông minh với AI</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center max-w-md">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.013 8.013 0 01-7-4c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Bắt đầu cuộc trò chuyện</h3>
                            <p className="text-gray-500 text-sm">
                                Hãy đặt câu hỏi hoặc bắt đầu cuộc trò chuyện với AI assistant của chúng tôi
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 max-w-4xl mx-auto">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-2xl px-4 py-3 rounded-lg ${
                                        message.isUser
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-gray-800 shadow-sm border border-gray-200'
                                    }`}
                                >
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                                    <p className={`text-xs mt-2 ${
                                        message.isUser ? 'text-blue-100' : 'text-gray-500'
                                    }`}>
                                        {message.timestamp.toLocaleTimeString('vi-VN')}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white text-gray-800 shadow-sm border border-gray-200 max-w-2xl px-4 py-3 rounded-lg">
                                    <div className="flex items-center space-x-2">
                                        <div className="flex space-x-1">
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                        </div>
                                        <span className="text-sm text-gray-500">AI đang suy nghĩ...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="bg-white border-t border-gray-200 p-6">
                <div className="max-w-4xl mx-auto">
                    <form onSubmit={sendMessage} className="relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Nhập tin nhắn của bạn..."
                            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}