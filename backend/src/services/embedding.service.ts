import { IAIStrategy, IFileStorageStrategy, IVectorStorageStrategy } from '../interfaces/IStrategy'
import { DocumentProcessorFactory } from '../utils/pattern.factories'
import { DocumentRepository } from '../repositories/document.repository'
import { AzureOpenAIStrategy } from '../strategies/azure-openai.strategy'
import { S3StorageStrategy, PineconeStorageStrategy } from '../strategies/storage.strategies'
import { UploadFileCommand, ProcessEmbeddingCommand, commandManager } from '../utils/commands'
import { eventManager } from '../utils/event.manager'
import { ResponseBuilder } from '../utils/builders'
import axios from 'axios'
import path from 'path'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import s3Client from '../providers/s3.connect'
import { S3_BUCKET_NAME } from '../config/env'

export class EmbeddingService {
    private aiStrategy: IAIStrategy
    private fileStorage: IFileStorageStrategy
    private vectorStorage: IVectorStorageStrategy
    private documentProcessor: DocumentProcessorFactory
    private documentRepository: DocumentRepository
    private processingQueue: Set<string> = new Set()

    constructor() {
        this.aiStrategy = new AzureOpenAIStrategy()
        this.fileStorage = new S3StorageStrategy()
        this.vectorStorage = new PineconeStorageStrategy()
        this.documentProcessor = new DocumentProcessorFactory()
        this.documentRepository = new DocumentRepository()
        
        this.initializePinecone().catch(error => {
            console.error('❌ Failed to initialize Pinecone:', error)
        })
    }

    private async initializePinecone(): Promise<void> {
        try {
            const isHealthy = await this.vectorStorage.healthCheck()
            if (isHealthy) {
                console.log('✅ Pinecone connection established')
            } else {
                console.warn('⚠️  Pinecone connection issues')
            }
        } catch (error) {
            console.error('❌ Pinecone initialization failed:', error)
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        return await this.aiStrategy.generateEmbedding(text)
    }

    async processMultipleFilesDirect(fileUrls: Array<{key: string, url: string, originalName?: string}>): Promise<void> {
        console.log(`� [SERVICE] processMultipleFilesDirect called with ${fileUrls.length} files`)
        console.log(`🚀 [SERVICE] File URLs:`, fileUrls)
        
        try {
            console.log(`🔄 Processing ${fileUrls.length} files for embedding...`)
            
            const promises = fileUrls.map(fileUrl => {
                console.log(`📋 [SERVICE] Creating promise for: ${fileUrl.key}`)
                return this.processSingleFile(fileUrl)
            })
            
            console.log(`⏳ [SERVICE] Waiting for ${promises.length} promises to settle...`)
            const results = await Promise.allSettled(promises)
            
            console.log(`✅ [SERVICE] Completed processing ${fileUrls.length} files`)
            console.log(`📊 [SERVICE] Results:`, results.map((r, i) => ({ 
                file: fileUrls[i].key, 
                status: r.status,
                error: r.status === 'rejected' ? r.reason : undefined 
            })))
        } catch (error) {
            console.error('❌ [SERVICE] processMultipleFilesDirect error:', error)
            throw error
        }
    }

    private async processSingleFile(fileUrl: {key: string, url: string, originalName?: string}): Promise<void> {
        console.log(`🔍 [DEBUG] Starting processSingleFile for: ${fileUrl.key}`)
        
        try {
            if (this.processingQueue.has(fileUrl.key)) {
                console.log(`⏭️  Skipping ${fileUrl.key} - already processing`)
                return
            }

            this.processingQueue.add(fileUrl.key)
            console.log(`📋 Added to processing queue: ${fileUrl.key}`)

            await eventManager.notify('embedding.processing.started', { 
                documentId: fileUrl.key 
            })
            console.log(`📢 Event notification sent: embedding.processing.started`)

            console.log(`📄 Processing: ${fileUrl.originalName || fileUrl.key}`)

            // Create document metadata
            const fileExtension = path.extname(fileUrl.originalName || fileUrl.key).toLowerCase().substring(1)
            console.log(`🔧 File extension detected: ${fileExtension}`)
            
            const documentInput = {
                fileName: fileUrl.originalName || fileUrl.key,
                fileSize: 0,
                fileType: fileExtension,
                s3Key: fileUrl.key,
                s3Url: fileUrl.url
            }
            console.log(`📝 Document input prepared:`, documentInput)

            const document = await this.documentRepository.create(documentInput)
            console.log(`✅ Document created in database:`, document.id)

            // Download file content from S3 using credentials
            console.log(`📥 Downloading file from S3: ${fileUrl.key}`)
            const getObjectCommand = new GetObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: fileUrl.key
            })
            
            const s3Response = await s3Client.send(getObjectCommand)
            console.log(`📥 S3 response metadata:`, {
                contentType: s3Response.ContentType,
                contentLength: s3Response.ContentLength,
                lastModified: s3Response.LastModified
            })
            
            if (!s3Response.Body) {
                throw new Error('No file content received from S3')
            }
            
            // Convert stream to buffer
            const s3Chunks: Uint8Array[] = []
            for await (const chunk of s3Response.Body as any) {
                s3Chunks.push(chunk)
            }
            const fileBuffer = Buffer.concat(s3Chunks)
            console.log(`✅ Downloaded ${fileBuffer.length} bytes from S3`)

            // Process document based on type 
            console.log(`🏭 Creating document processor for: ${fileExtension}`)
            const processor = this.documentProcessor.createProcessor(fileExtension)
            console.log(`📄 Extracting text from buffer...`)
            const textContent = await processor.extractText(fileBuffer)
            console.log(`📝 Text extracted - length: ${textContent?.length || 0} characters`)
            console.log(`📝 Text preview: ${textContent?.substring(0, 100) || 'No content'}...`)

            if (!textContent || textContent.trim().length === 0) {
                throw new Error('No text content extracted from file')
            }

            // Create and execute processing command
            console.log(`🚛 Creating ProcessEmbeddingCommand...`)
            const processingCommand = new ProcessEmbeddingCommand(
                fileUrl.key,
                textContent,
                fileUrl.originalName || fileUrl.key,
                this.aiStrategy,
                this.vectorStorage
            )

            console.log(`⚡ Executing ProcessEmbeddingCommand...`)
            await commandManager.execute(processingCommand)
            console.log(`✅ ProcessEmbeddingCommand completed successfully`)

            // Update document status
            const { RecursiveCharacterTextSplitter } = await import('langchain/text_splitter')
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200
            })
            const chunks = await textSplitter.splitText(textContent)
            console.log(`📊 Text split into ${chunks.length} chunks`)
            
            await this.documentRepository.updateStatus(fileUrl.key, 'embedded', chunks.length)
            console.log(`📈 Database updated: status=embedded, chunks=${chunks.length}`)

            console.log(`✅ Successfully processed: ${fileUrl.originalName || fileUrl.key}`)

        } catch (error) {
            console.error(`❌ Error processing ${fileUrl.key}:`, {
                error: error,
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            })
            
            await this.documentRepository.updateStatus(
                fileUrl.key, 
                'error', 
                0, 
                error instanceof Error ? error.message : 'Unknown error'
            )

            await eventManager.notify('embedding.processing.failed', { 
                documentId: fileUrl.key,
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        } finally {
            this.processingQueue.delete(fileUrl.key)
            console.log(`🏁 Removed from processing queue: ${fileUrl.key}`)
        }
    }

    async queryEmbeddings(queryText: string, topK: number = 5): Promise<Array<{id: string, score: number, metadata?: any}>> {
        try {
            const queryEmbedding = await this.aiStrategy.generateEmbedding(queryText)
            return await this.vectorStorage.query(queryEmbedding, topK)
        } catch (error) {
            console.error('❌ Query embedding error:', error)
            return []
        }
    }

    async deleteDocument(documentId: string): Promise<void> {
        try {
            // Get all vector IDs for this document
            const document = await this.documentRepository.findById(documentId)
            if (!document) {
                throw new Error('Document not found')
            }

            // Generate vector IDs (assuming pattern: documentId_chunk_0, documentId_chunk_1, etc.)
            const vectorIds: string[] = []
            for (let i = 0; i < document.totalChunks; i++) {
                vectorIds.push(`${documentId}_chunk_${i}`)
            }

            // Delete from vector storage
            if (vectorIds.length > 0) {
                await this.vectorStorage.delete(vectorIds)
            }

            // Delete from document repository
            await this.documentRepository.delete(documentId)

            console.log(`🗑️ Deleted document: ${documentId}`)
        } catch (error) {
            console.error(`❌ Error deleting document ${documentId}:`, error)
            throw error
        }
    }

    getProcessingStatus(): { processing: string[], completed: number } {
        return {
            processing: Array.from(this.processingQueue),
            completed: 0 // Could be enhanced to track completed counts
        }
    }
}

export default new EmbeddingService()
