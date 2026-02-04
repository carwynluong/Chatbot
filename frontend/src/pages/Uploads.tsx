import { useState, useEffect } from 'react'
import UploadGenAIAPI from '../api/apiUploadGenAI'
import ApiEmbeddingAI from '../api/apiEmbeddingAI'
import type { FileItem } from '../interfaces/upload.interface'
import toast from 'react-hot-toast'
import Header from '../components/Header'

export default function UploadPage() {
    const [files, setFiles] = useState<FileItem[]>([])
    const [selectedFiles, setSelectedFiles] = useState<string[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const [isEmbedding, setIsEmbedding] = useState(false)
    const [embeddedFiles, setEmbeddedFiles] = useState<Set<string>>(new Set())

    useEffect(() => {
        loadFiles()
    }, [])

    const loadFiles = async () => {
        try {
            const res = await UploadGenAIAPI.listFiles()
            const fileWithEmbeding = res.files.map(file => ({
                ...file,
                name: file.key.split('/').pop() || file.key,
                isEmbedded: embeddedFiles.has(file.key),
            }))
            setFiles(fileWithEmbeding)
        } catch (error) {
            toast.error('Failed to load files. Please try again.')
        }
    }

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files
        if (!selectedFiles || selectedFiles.length === 0) return

        setIsUploading(true)
        try {
            const fileArray = Array.from(selectedFiles)

            await UploadGenAIAPI.uploadMultipleFiles(fileArray)
            toast.success('Files ${fileArray.length} uploaded successfully')
            await loadFiles()
        } catch (error) {
            toast.error('File upload failed. Please try again.')
        } finally {
            setIsUploading(false)
        }
    }

    const handleFileSelect = (fileKey: string) => {
        setSelectedFiles(prev =>
            prev.includes(fileKey)
                ? prev.filter(key => key !== fileKey)
                : [...prev, fileKey]
        )
    }

    const handleEmbedding = async () => {
        if (selectedFiles.length === 0) {
            toast.error('Please select files to embed.')
            return
        }

        setIsEmbedding(true)
        try {
            await ApiEmbeddingAI.processFiles(selectedFiles)
            toast.success('Files embedded successfully')

            setEmbeddedFiles(prev => new Set([...prev, ...selectedFiles]))
            setSelectedFiles([])
            loadFiles()

        } catch (error) {
            toast.error('Lỗi khi embedding file')
        } finally {
            setIsEmbedding(false)
        }
    }
    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <Header title="Quản lý File" showChatButton />

            <div className="container mx-auto px-4 py-6">
                {/* Upload Section */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4">Upload File</h2>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <input
                            type="file"
                            multiple
                            onChange={handleFileUpload}
                            className="hidden"
                            id="file-upload"
                            disabled={isUploading}
                        />
                        <label
                            htmlFor="file-upload"
                            className={`cursor-pointer ${isUploading ? 'opacity-50' : ''}`}
                        >
                            <div className="text-gray-600">
                                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <p className="mt-2 text-sm">
                                    {isUploading ? 'Đang upload...' : 'Nhấp để chọn file hoặc kéo thả file vào đây'}
                                </p>
                                <p className="text-xs text-gray-500">Hỗ trợ nhiều file cùng lúc</p>
                            </div>
                        </label>
                    </div>
                </div>

                {/* File List */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold">Danh sách File ({files.length})</h2>
                        <div className="flex gap-2">
                            <button
                                onClick={handleEmbedding}
                                disabled={selectedFiles.length === 0 || isEmbedding}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {isEmbedding ? 'Đang embedding...' : `Embedding (${selectedFiles.length})`}
                            </button>
                        </div>
                    </div>

                    {files.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            Chưa có file nào được upload
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {files.map((file) => (
                                <div
                                    key={file.key}
                                    className={`flex items-center justify-between p-3 border rounded-lg ${selectedFiles.includes(file.key) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                                        } ${file.isEmbedded ? 'bg-green-50 border-green-200' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedFiles.includes(file.key)}
                                            onChange={() => handleFileSelect(file.key)}
                                            disabled={file.isEmbedded}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <div>
                                            <p className="font-medium text-gray-900">{file.name}</p>
                                            <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {file.isEmbedded && (
                                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                                Đã embedding
                                            </span>
                                        )}
                                        <a
                                            href={file.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-700 text-sm"
                                        >
                                            Xem
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* History Section */}
                {embeddedFiles.size > 0 && (
                    <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
                        <h2 className="text-lg font-semibold mb-4">File đã Embedding ({embeddedFiles.size})</h2>
                        <div className="space-y-2">
                            {files.filter(file => embeddedFiles.has(file.key)).map((file) => (
                                <div key={file.key} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <div>
                                        <p className="font-medium text-gray-900">{file.name}</p>
                                        <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                                    </div>
                                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                        Sẵn sàng chat
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )

}