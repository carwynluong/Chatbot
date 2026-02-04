// Tạo file: d:\Nodejs\genAI\frontend\src\components\Header.tsx
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../api/apiUserGenAI'

interface HeaderProps {
    title: string
    showUploadButton?: boolean
    showChatButton?: boolean
}

export default function Header({ title, showUploadButton = false, showChatButton = false }: HeaderProps) {
    const { user, logout } = useAuth()
    const navigate = useNavigate()

    return (
        <div className="bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
            <div className="flex items-center gap-4">
                {showUploadButton && (
                    <button
                        onClick={() => navigate('/upload')}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer"
                    >
                        Quản lý File
                    </button>
                )}
                {showChatButton && (
                    <button
                        onClick={() => navigate('/chat')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                    >
                        Trò chuyện
                    </button>
                )}
                <span className="text-sm text-gray-600">Xin chào, {user?.name}</span>
                <button
                    onClick={logout}
                    className="text-sm text-red-600 hover:text-red-700 cursor-pointer"
                >
                    Đăng xuất
                </button>
            </div>
        </div>
    )
}
