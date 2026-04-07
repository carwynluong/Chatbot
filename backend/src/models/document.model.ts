export interface DocumentMetadata {
    id: string // document file key from S3
    fileName: string
    fileSize: number
    fileType: string
    s3Key: string
    s3Url: string
    totalChunks: number
    status: 'processing' | 'embedded' | 'error'
    createdAt: string
    updatedAt: string
    errorMessage?: string
}

export interface DocumentChunk {
    documentId: string // S3 key của file
    chunkIndex: number
    content: string
    chunkId: string // documentId + "_chunk_" + chunkIndex
    vectorId: string // ID corresponding to Pinecone vector
    createdAt: string
}

export interface CreateDocumentInput {
    fileName: string
    fileSize: number
    fileType: string
    s3Key: string
    s3Url: string
    status?: 'processing' | 'embedded' | 'error'
    totalChunks?: number
    errorMessage?: string
}