import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CloudArrowUpIcon, DocumentIcon, TrashIcon } from '@heroicons/react/24/outline'
import UploadGenAIAPI from '../api/apiUploadGenAI'
import ApiEmbeddingAI from '../api/apiEmbeddingAI'
import type { FileItem } from '../interfaces/upload.interface'
import toast from 'react-hot-toast'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isEmbedding, setIsEmbedding] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadFiles()
    }
  }, [isOpen])

  const loadFiles = async () => {
    setIsLoading(true)
    try {
      const res = await UploadGenAIAPI.listFiles()
      
      const fileList = res.files || []
      const fileWithEmbedding = fileList.map(file => ({
        ...file,
        name: file.name || file.key.split('/').pop() || file.key,
        isEmbedded: file.isEmbedded || false,
      }))
      
      setFiles(fileWithEmbedding)
      console.log(`Loaded ${fileWithEmbedding.length} files, ${fileWithEmbedding.filter(f => f.isEmbedded).length} embedded`)
      
    } catch (error) {
      console.error('Error loading files:', error)
      toast.error('Không thể tải danh sách file')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    setIsUploading(true)
    const uploadPromises = Array.from(fileList).map(async (file) => {
      try {
        await UploadGenAIAPI.uploadFile(file)
        toast.success(`Tải lên ${file.name} thành công`)
      } catch (error) {
        toast.error(`Tải lên ${file.name} thất bại`)
        throw error
      }
    })

    try {
      await Promise.all(uploadPromises)
      await loadFiles()
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e.target.files)
    e.target.value = '' // Reset input
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    handleFileUpload(e.dataTransfer.files)
  }

  const toggleFileSelection = (fileKey: string) => {
    setSelectedFiles(prev => 
      prev.includes(fileKey) 
        ? prev.filter(key => key !== fileKey)
        : [...prev, fileKey]
    )
  }

  const createEmbeddings = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Vui lòng chọn file để tạo embedding')
      return
    }

    console.log('🚀 Starting embedding process for files:', selectedFiles)
    setIsEmbedding(true)
    
    // Show loading toast
    const loadingToast = toast.loading(
      `Đang tạo embedding cho ${selectedFiles.length} file(s)... Vui lòng đợi!`
    )
    
    try {
      // Use batch processing for multiple files for better performance
      if (selectedFiles.length > 1) {
        console.log('📦 Processing multiple files:', selectedFiles)
        const result = await ApiEmbeddingAI.processFiles(selectedFiles)
        console.log('✅ Batch embedding result:', result)
        
        toast.dismiss(loadingToast)
        toast.success(`✅ Tạo embedding cho ${selectedFiles.length} files thành công!`)
      } else {
        // Single file processing
        const fileKey = selectedFiles[0]
        console.log('📄 Processing single file:', fileKey)
        
        const result = await ApiEmbeddingAI.createEmbedding(fileKey)
        console.log('✅ Single embedding result:', result)
        
        toast.dismiss(loadingToast)
        toast.success(`✅ Tạo embedding cho "${fileKey}" thành công!`)
      }
      
      console.log('🔄 Reloading file list...')
      setSelectedFiles([])
      await loadFiles()
      console.log('✅ File list reloaded')
      
    } catch (error) {
      console.error('❌ Embedding error:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        selectedFiles: selectedFiles
      })
      
      toast.dismiss(loadingToast)
      toast.error(`❌ Lỗi khi tạo embedding: ${error instanceof Error ? error.message : 'Vui lòng thử lại!'}`)
      
    } finally {
      setIsEmbedding(false)
      console.log('🏁 Embedding process completed')
    }
  }

  const deleteFiles = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Vui lòng chọn file để xóa')
      return
    }

    const deletePromises = selectedFiles.map(async (fileKey) => {
      try {
        await UploadGenAIAPI.deleteFile(fileKey)
        toast.success(`Xóa ${fileKey} thành công`)
      } catch (error) {
        toast.error(`Xóa ${fileKey} thất bại`)
        throw error
      }
    })

    try {
      await Promise.all(deletePromises)
      setSelectedFiles([])
      await loadFiles()
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN')
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    Quản lý tài liệu S3
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Upload Area */}
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    Kéo thả file hoặc click để chọn
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Hỗ trợ PDF, DOC, DOCX, TXT (tối đa 10MB mỗi file)
                  </p>
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload"
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer ${
                      isUploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isUploading ? 'Đang tải lên...' : 'Chọn file'}
                  </label>
                </div>

                {/* Actions */}
                {selectedFiles.length > 0 && (
                  <div className="flex gap-4 mb-6">
                    <button
                      onClick={createEmbeddings}
                      disabled={isEmbedding}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isEmbedding && (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {isEmbedding ? '🔄 Đang xử lý...' : `🧠 Tạo Embedding (${selectedFiles.length})`}
                    </button>
                    <button
                      onClick={deleteFiles}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <TrashIcon className="w-4 h-4 inline mr-2" />
                      Xóa ({selectedFiles.length})
                    </button>
                  </div>
                )}

                {/* File List */}
                <div className="max-h-96 overflow-y-auto">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="text-gray-500 mt-2">Đang tải...</p>
                    </div>
                  ) : files.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      Chưa có file nào trên S3
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600 mb-4 flex justify-between">
                        <span>Tổng cộng: {files.length} files</span>
                        <span>Đã embedded: {files.filter(f => f.isEmbedded).length} files</span>
                      </div>
                      {files.map((file) => (
                        <div
                          key={file.key}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedFiles.includes(file.key)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                          onClick={() => toggleFileSelection(file.key)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedFiles.includes(file.key)}
                            onChange={() => toggleFileSelection(file.key)}
                            className="mr-3"
                          />
                          <DocumentIcon className="w-5 h-5 text-gray-400 mr-3" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.size)}{file.lastModified && ` • ${formatDate(file.lastModified)}`}
                              {file.isEmbedded && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  Đã embed
                                </span>
                              )}
                              {!file.isEmbedded && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Chưa embed
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}