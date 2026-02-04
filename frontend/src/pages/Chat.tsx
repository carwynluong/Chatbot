// Cập nhật: d:\Nodejs\genAI\frontend\src\pages\Chat.tsx
import { useEffect, useState } from 'react'
import { useAuth } from '../api/apiUserGenAI'
import type { Message } from '../interfaces'
import ChatAPI from '../api/apiChatGenAI'
import Header from '../components/Header'

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { user } = useAuth()

    useEffect(() => {
        if (user?.id) {
            ChatAPI.getChatHistory(user.id).then((response) => {
                if (response.history && response.history.length > 0) {
                    const latestSession = response.history.reduce((latest, current) => 
                        current.timestamp > latest.timestamp ? current : latest
                    )
                    
                    const messagesWithDate = latestSession.messages.map((msg: any) => ({
                        ...msg,
                        timestamp: new Date(msg.timestamp)
                    }))
                    setMessages(messagesWithDate)
                }
            }).catch(() => {
                setMessages([])
            })
        }
    }, [user])

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
                ChatAPI.saveChatHistory(user.id, finalMessages)
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

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            <Header title="GenAI Chat" showUploadButton />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-gray-500 mt-8">
                        Bắt đầu cuộc trò chuyện với AI Assistant
                    </div>
                )}

                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.isUser
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-800 shadow-sm'
                                }`}
                        >
                            <p className="text-sm">{message.content}</p>
                            <p className={`text-xs mt-1 ${message.isUser ? 'text-blue-100' : 'text-gray-500'
                                }`}>
                                {message.timestamp.toLocaleTimeString()}
                            </p>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white text-gray-800 shadow-sm max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
                            <div className="flex items-center space-x-2">
                                <div className="animate-pulse">AI đang trả lời...</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="bg-white border-t p-4">
                <form onSubmit={sendMessage} className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Nhập câu hỏi của bạn..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Gửi
                    </button>
                </form>
            </div>
        </div>
    )
}
