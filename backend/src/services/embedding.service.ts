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
import s3Service from '../providers/s3.connect'
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
            console.error('Failed to initialize Pinecone:', error)
        })
    }

    private async initializePinecone(): Promise<void> {
        try {
            const isHealthy = await this.vectorStorage.healthCheck()
            if (isHealthy) {
                console.log('Pinecone connection established')
            } else {
                console.warn('Pinecone connection issues')
            }
        } catch (error) {
            console.error('Pinecone initialization failed:', error)
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        return await this.aiStrategy.generateEmbedding(text)
    }

    async processMultipleFilesDirect(fileUrls: Array<{key: string, url: string, originalName?: string}>): Promise<void> {
        try {            
            const promises = fileUrls.map(fileUrl => {
                return this.processSingleFile(fileUrl)
            })
            
            const results = await Promise.allSettled(promises)
        
            // Check for failures and throw error if any file failed
            const failures = results.filter(r => r.status === 'rejected')
            if (failures.length > 0) {
                const failedFiles = failures.map((f, i) => {
                    const originalIndex = results.indexOf(f)
                    return {
                        file: fileUrls[originalIndex]?.key || 'unknown',
                        error: f.reason
                    }
                })
                                
                const errorMessage = `Failed to process ${failures.length} out of ${fileUrls.length} files`
                throw new Error(errorMessage)
            }
            
        } catch (error) {
            console.error('[SERVICE] processMultipleFilesDirect error:', error)
            throw error
        }
    }

    private async processSingleFile(fileUrl: {key: string, url: string, originalName?: string}): Promise<void> {        
        try {
            if (this.processingQueue.has(fileUrl.key)) {
                return
            }

            this.processingQueue.add(fileUrl.key)

            await eventManager.notify('embedding.processing.started', { 
                documentId: fileUrl.key 
            })
            // Download file content from S3 first - Don't create DB record yet
            const getObjectCommand = new GetObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: fileUrl.key
            })
            
            const s3Response = await s3Service.getS3Client().send(getObjectCommand)
            
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
            const fileExtension = path.extname(fileUrl.originalName || fileUrl.key).toLowerCase().substring(1)
            
            const processor = this.documentProcessor.createProcessor(fileExtension)
            const textContent = await processor.extractText(fileBuffer)

            if (!textContent || textContent.trim().length === 0) {
                throw new Error('No text content extracted from file')
            }

            // Create and execute processing command - this is where embedding happens
            const processingCommand = new ProcessEmbeddingCommand(
                fileUrl.key,
                textContent,
                fileUrl.originalName || fileUrl.key,
                this.aiStrategy,
                this.vectorStorage
            )

            await commandManager.execute(processingCommand)
            console.log(`ProcessEmbeddingCommand completed successfully`)

            // ONLY NOW create document in database after successful embedding
            const { RecursiveCharacterTextSplitter } = await import('langchain/text_splitter')
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200
            })
            const chunks = await textSplitter.splitText(textContent)
            
            const documentInput = {
                fileName: fileUrl.originalName || fileUrl.key,
                fileSize: fileBuffer.length,
                fileType: fileExtension,
                s3Key: fileUrl.key,
                s3Url: fileUrl.url,
                status: 'embedded' as const,
                totalChunks: chunks.length
            }

            const document = await this.documentRepository.create(documentInput)

            await eventManager.notify('embedding.processing.completed', { 
                documentId: fileUrl.key,
                totalChunks: chunks.length
            })

            console.log(`Successfully processed: ${fileUrl.originalName || fileUrl.key}`)

        } catch (error) {
            console.error(`Error processing ${fileUrl.key}:`, {
                error: error,
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            })
            
            // DO NOT create database record on failure - just log and notify
            await eventManager.notify('embedding.processing.failed', { 
                documentId: fileUrl.key,
                error: error instanceof Error ? error.message : 'Unknown error'
            })

            // Re-throw error to propagate to parent
            throw error
        } finally {
            this.processingQueue.delete(fileUrl.key)
            console.log(`🏁Removed from processing queue: ${fileUrl.key}`)
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

            console.log(`Deleted document: ${documentId}`)
        } catch (error) {
            console.error(`Error deleting document ${documentId}:`, error)
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
