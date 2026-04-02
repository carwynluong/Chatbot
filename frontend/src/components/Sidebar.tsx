import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../api/apiUserGenAI'
import ChatAPI from '../api/apiChatGenAI'
import UploadModal from './UploadModal'
import { 
  PlusIcon, 
  ChatBubbleLeftRightIcon,
  DocumentArrowUpIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  TrashIcon
} from '@heroicons/react/24/outline'

interface ChatSession {
  id: string
  title: string
  timestamp: string
  messageCount: number
}

export default function Sidebar() {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currentChatId = searchParams.get('chat')

  useEffect(() => {
    loadChatSessions()
  }, [user])

  const loadChatSessions = async () => {
    if (!user?.id) return
    
    try {
      const response = await ChatAPI.getChatHistory(user.id)
      if (response.history) {
        const sessions = response.history
          .map((session: any, index: number) => ({
            id: session.sessionId || `session-${index}`,
            title: session.messages?.[0]?.content?.substring(0, 30) + '...' || `Chat ${index + 1}`,
            timestamp: session.timestamp,
            messageCount: session.messages?.length || 0
          }))
        setChatSessions(sessions)
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error)
    }
  }

  const startNewChat = () => {
    // Navigate to new chat with unique ID
    const newChatId = `chat_${Date.now()}`
    navigate(`/?chat=${newChatId}&new=true`)
  }

  const selectChatSession = (sessionId: string) => {
    navigate(`/?chat=${sessionId}`)
  }

  const deleteChatSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Ngăn việc select chat khi click delete
    
    if (!user?.id) {
      console.log('No user ID found')
      return
    }
    
    if (confirm('Bạn có chắc chắn muốn xóa cuộc trò chuyện này?')) {
      console.log('Deleting session:', sessionId, 'for user:', user.id)
      
      try {
        const response = await ChatAPI.deleteChatSession(user.id, sessionId)
        console.log('Delete response:', response)
        
        // Force reload chat sessions
        console.log('Reloading chat sessions...')
        await loadChatSessions()
        
        // Nếu đang ở chat bị xóa, chuyển về trang chủ
        if (currentChatId === sessionId) {
          console.log('Navigating away from deleted session')
          navigate('/')
        }
        
        console.log('Chat session deleted successfully')
        
      } catch (error) {
        console.error('Failed to delete chat session:', error)
        alert('Có lỗi xảy ra khi xóa cuộc trò chuyện. Vui lòng thử lại.')
      }
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleLogin = () => {
    navigate('/login')
  }

  if (isSidebarCollapsed) {
    return (
      <div className="w-16 bg-gray-900 text-white flex flex-col h-full">
        <button 
          onClick={() => setIsSidebarCollapsed(false)}
          className="p-4 hover:bg-gray-800 transition-colors"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="w-80 bg-gray-900 text-white flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">AI Chatbot</h1>
            <button 
              onClick={() => setIsSidebarCollapsed(true)}
              className="p-1 hover:bg-gray-800 rounded transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Chat mới</span>
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto px-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Lịch sử chat</h3>
          <div className="space-y-2">
            {chatSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => selectChatSession(session.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors group ${
                  currentChatId === session.id ? 'bg-gray-800' : ''
                }`}
              >
                <ChatBubbleLeftRightIcon className="w-4 h-4 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{session.title}</p>
                  <p className="text-xs text-gray-400">{session.messageCount} tin nhắn</p>
                </div>
                <button
                  onClick={(e) => deleteChatSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-600 rounded transition-all"
                  title="Xóa cuộc trò chuyện"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
            {chatSessions.length === 0 && (
              <p className="text-sm text-gray-500 italic">Chưa có cuộc trò chuyện nào</p>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          {/* Upload Documents Button */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <DocumentArrowUpIcon className="w-5 h-5" />
            <span>Quản lý tài liệu</span>
          </button>

          {/* User Section */}
          {user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 px-2 py-2">
                <UserCircleIcon className="w-6 h-6" />
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="Đăng xuất"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <UserCircleIcon className="w-5 h-5" />
              <span>Đăng nhập</span>
            </button>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <UploadModal 
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
        />
      )}
    </>
  )
}