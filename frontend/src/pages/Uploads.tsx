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
    const [deleteConfirm, setDeleteConfirm] = useState<{
        show: boolean
        fileKey: string
        fileName: string
    }>({
        show: false,
        fileKey: '',
        fileName: ''
    })

    useEffect(() => {
        loadFiles()
    }, [])

    const loadFiles = async () => {
        try {
            const res = await UploadGenAIAPI.listFiles()
            const fileWithEmbedding = res.files.map(file => ({
                ...file,
                name: file.fileName || file.key.split('/').pop() || file.key,
                isEmbedded: file.status === 'embedded',
                status: file.status || 'not_processed'
            }))
            setFiles(fileWithEmbedding)
        } catch (error) {
            console.error('Load files error:', error)
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
        // Only allow embedding files that are not yet embedded
        const nonEmbeddedFiles = selectedFiles.filter(fileKey => {
            const file = files.find(f => f.key === fileKey)
            return file && !file.isEmbedded && file.status !== 'processing'
        })

        if (nonEmbeddedFiles.length === 0) {
            toast.error('Vui lòng chọn file chưa embedding để xử lý.')
            return
        }

        console.log('🔄 Starting manual embedding process for:', nonEmbeddedFiles)

        setIsEmbedding(true)
        try {
            await ApiEmbeddingAI.processFiles(nonEmbeddedFiles)
            toast.success(`✅ Tạo embedding cho ${nonEmbeddedFiles.length} files thành công!`)

            setEmbeddedFiles(prev => new Set([...prev, ...nonEmbeddedFiles]))
            setSelectedFiles([])
            loadFiles()

        } catch (error) {
            console.error('❌ Manual embedding error:', error)
            toast.error('Lỗi khi tạo embedding cho files')
        } finally {
            setIsEmbedding(false)
        }
    }

    const handleDeleteFile = async (fileKey: string, fileName: string) => {
        setDeleteConfirm({
            show: true,
            fileKey,
            fileName
        })
    }

    const confirmDeleteFile = async () => {
        try {
            console.log('🔍 Attempting to delete file:', deleteConfirm.fileKey)
            await UploadGenAIAPI.deleteFile(deleteConfirm.fileKey)
            toast.success(`File "${deleteConfirm.fileName}" đã được xóa thành công`)
            
            // Remove from selected files if it was selected  
            setSelectedFiles(prev => prev.filter(key => key !== deleteConfirm.fileKey))
            setEmbeddedFiles(prev => {
                const newSet = new Set(prev)
                newSet.delete(deleteConfirm.fileKey)
                return newSet
            })
            
            // Reload files list
            await loadFiles()
            
        } catch (error) {
            console.error('❌ Delete file error details:', {
                error,
                response: error.response,
                status: error.response?.status,
                data: error.response?.data
            })
            
            if (error.response?.status === 401) {
                toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
            } else if (error.response?.status === 404) {
                toast.error(`File "${deleteConfirm.fileName}" không tồn tại hoặc đã bị xóa`)
            } else {
                toast.error(`Lỗi khi xóa file "${deleteConfirm.fileName}"`)
            }
        } finally {
            setDeleteConfirm({ show: false, fileKey: '', fileName: '' })
        }
    }

    const cancelDeleteFile = () => {
        setDeleteConfirm({ show: false, fileKey: '', fileName: '' })
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
                                {isEmbedding ? 'Đang tạo embedding...' : `Tạo Embedding (${selectedFiles.filter(fileKey => {
                                    const file = files.find(f => f.key === fileKey)
                                    return file && !file.isEmbedded && file.status !== 'processing'
                                }).length})`}
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
                                            disabled={file.isEmbedded || file.status === 'processing'}
                                            className="w-4 h-4 text-blue-600 disabled:opacity-50"
                                            title={file.isEmbedded ? 'File đã được embedding' : file.status === 'processing' ? 'File đang được xử lý' : 'Chọn file để embedding'}
                                        />
                                        <div>
                                            <p className="font-medium text-gray-900">{file.name}</p>
                                            <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {file.isEmbedded && (
                                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                                ✅ Đã embedding
                                            </span>
                                        )}
                                        {!file.isEmbedded && file.status === 'not_processed' && (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                                📄 Chưa embedding
                                            </span>
                                        )}
                                        {!file.isEmbedded && file.status === 'processing' && (
                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-600 text-xs rounded-full">
                                                ⏳ Đang xử lý...
                                            </span>
                                        )}
                                        <a
                                            href={file.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-700 text-sm px-2 py-1 rounded hover:bg-blue-50"
                                            title="Xem file"
                                        >
                                            Xem
                                        </a>
                                        <button
                                            onClick={() => handleDeleteFile(file.key, file.name || file.key.split('/').pop() || file.key)}
                                            className="text-red-600 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-50"
                                            title="Xóa file"
                                        >
                                            Xóa
                                        </button>
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
            
            {/* Delete Confirmation Modal */}
            {deleteConfirm.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md mx-4">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900">Xác nhận xóa file</h3>
                        <p className="text-gray-600 mb-6">
                            Bạn có chắc chắn muốn xóa file <strong>{deleteConfirm.fileName}</strong>? 
                            <br />
                            <span className="text-sm text-red-600">
                                File sẽ bị xóa khỏi S3, embedding và database. Hành động này không thể hoàn tác!
                            </span>
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={cancelDeleteFile}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={confirmDeleteFile}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                Xóa file
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )

}