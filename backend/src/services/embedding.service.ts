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
        console.log(`🔄 Processing ${fileUrls.length} files for embedding...`)
        
        const promises = fileUrls.map(fileUrl => this.processSingleFile(fileUrl))
        await Promise.allSettled(promises)
        
        console.log(`✅ Completed processing ${fileUrls.length} files`)
    }

    private async processSingleFile(fileUrl: {key: string, url: string, originalName?: string}): Promise<void> {
        try {
            if (this.processingQueue.has(fileUrl.key)) {
                console.log(`⏭️  Skipping ${fileUrl.key} - already processing`)
                return
            }

            this.processingQueue.add(fileUrl.key)

            await eventManager.notify('embedding.processing.started', { 
                documentId: fileUrl.key 
            })

            console.log(`📄 Processing: ${fileUrl.originalName || fileUrl.key}`)

            // Create document metadata
            const fileExtension = path.extname(fileUrl.originalName || fileUrl.key).toLowerCase().substring(1)
            const documentInput = {
                fileName: fileUrl.originalName || fileUrl.key,
                fileSize: 0,
                fileType: fileExtension,
                s3Key: fileUrl.key,
                s3Url: fileUrl.url
            }

            const document = await this.documentRepository.create(documentInput)

            // Download file content
            const response = await axios.get(fileUrl.url, { 
                responseType: 'arraybuffer',
                timeout: 30000
            })
            const fileBuffer = Buffer.from(response.data)

            // Process document based on type 
            const processor = this.documentProcessor.createProcessor(fileExtension)
            const textContent = await processor.extractText(fileBuffer)

            if (!textContent || textContent.trim().length === 0) {
                throw new Error('No text content extracted from file')
            }

            // Create and execute processing command
            const processingCommand = new ProcessEmbeddingCommand(
                fileUrl.key,
                textContent,
                fileUrl.originalName || fileUrl.key,
                this.aiStrategy,
                this.vectorStorage
            )

            await commandManager.execute(processingCommand)

            // Update document status
            const { RecursiveCharacterTextSplitter } = await import('langchain/text_splitter')
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200
            })
            const chunks = await textSplitter.splitText(textContent)
            
            await this.documentRepository.updateStatus(fileUrl.key, 'embedded', chunks.length)

            console.log(`✅ Successfully processed: ${fileUrl.originalName || fileUrl.key}`)

        } catch (error) {
            console.error(`❌ Error processing ${fileUrl.key}:`, error)
            
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
