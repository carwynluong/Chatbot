import { Request, Response } from 'express'
import embeddingService from '../services/embedding.service'
import uploadsService from '../services/uploads.service'
import { ResponseBuilder } from '../utils/builders'
import { ErrorFactory } from '../utils/pattern.factories'
import statusCodes from '../constants/statusCodes'

export class EmbeddingController {
    private embeddingService: typeof embeddingService
    private uploadsService: typeof uploadsService
    private errorFactory: ErrorFactory

    constructor() {
        this.embeddingService = embeddingService
        this.uploadsService = uploadsService
        this.errorFactory = new ErrorFactory()
    }

    async processFileEmbedding(req: Request, res: Response) {
        try {
            const { fileKeys } = req.body
            
            if (!fileKeys || !Array.isArray(fileKeys) || fileKeys.length === 0) {
                return ResponseBuilder.validation('fileKeys array is required')
                    .send(res)
            }
            
            console.log(`📤 Processing ${fileKeys.length} files for embedding...`)
            
            // Convert file keys to URLs
            const fileUrls = fileKeys.map(key => ({
                key: key,
                url: this.uploadsService.getS3Url(key),
                originalName: key.split('/').pop() // Extract filename from key
            }))
            
            console.log(`🔄 Processing files:`, fileUrls.map(f => f.originalName))
            
            // Wait for embedding processing to complete
            console.log('🚀 [CONTROLLER] About to call processMultipleFilesDirect and wait for completion...')
            await this.embeddingService.processMultipleFilesDirect(fileUrls)
            console.log('✅ [CONTROLLER] Embedding processing completed successfully')
            
            // Return success response only after processing is actually complete
            ResponseBuilder.success({
                filesProcessed: fileKeys,
                status: 'completed',
                message: `Successfully processed ${fileKeys.length} files for embeddings`
            }, 'Files processed successfully')
                .send(res)
            
        } catch (error) {
            console.error('❌ Error in process file embedding:', error)
            
            ResponseBuilder.error('Failed to process file embeddings')
                .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
                .setData({ error: error instanceof Error ? error.message : 'Unknown error' })
                .send(res)
        }
    }

    async queryEmbeddings(req: Request, res: Response) {
        try {
            const { query, topK = 5 } = req.body

            if (!query) {
                return ResponseBuilder.validation('Query text is required')
                    .send(res)
            }

            // Query similar embeddings
            const results = await this.embeddingService.queryEmbeddings(query, topK)

            ResponseBuilder.success({
                query,
                topK,
                results,
                count: results.length
            }, 'Query completed successfully')
                .send(res)

        } catch (error) {
            console.error('❌ Error querying embeddings:', error)
            
            ResponseBuilder.error('Failed to query embeddings')
                .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
                .send(res)
        }
    }

    async getProcessingStatus(req: Request, res: Response) {
        try {
            const status = this.embeddingService.getProcessingStatus()

            ResponseBuilder.success(status, 'Processing status retrieved successfully')
                .send(res)

        } catch (error) {
            console.error('❌ Error getting processing status:', error)
            
            ResponseBuilder.error('Failed to get processing status')
                .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
                .send(res)
        }
    }

    async deleteDocument(req: Request, res: Response) {
        try {
            const { documentId } = req.params

            if (!documentId) {
                return ResponseBuilder.validation('Document ID is required')
                    .send(res)
            }

            // Delete document and its embeddings
            await this.embeddingService.deleteDocument(documentId)

            ResponseBuilder.success(
                { documentId }, 
                'Document deleted successfully'
            ).send(res)

        } catch (error) {
            console.error('❌ Error deleting document:', error)
            
            if ((error as any).message === 'Document not found') {
                ResponseBuilder.notFound('Document', req.params.documentId)
                    .send(res)
            } else {
                ResponseBuilder.error('Failed to delete document')
                    .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
                    .send(res)
            }
        }
    }

    // Health check for embedding service
    async healthCheck(req: Request, res: Response) {
        try {
            // Test embedding generation
            const testEmbedding = await this.embeddingService.generateEmbedding('test')
            const isHealthy = Array.isArray(testEmbedding) && testEmbedding.length > 0

            if (isHealthy) {
                ResponseBuilder.success({
                    status: 'healthy',
                    embeddingDimensions: testEmbedding.length
                }, 'Embedding service is healthy')
                    .send(res)
            } else {
                ResponseBuilder.error('Embedding service is unhealthy')
                    .setStatus(statusCodes.SERVICE_UNAVAILABLE || 503)
                    .send(res)
            }

        } catch (error) {
            console.error('❌ Health check failed:', error)
            
            ResponseBuilder.error('Embedding service is unhealthy')
                .setStatus(statusCodes.SERVICE_UNAVAILABLE || 503)
                .setData({ error: error instanceof Error ? error.message : 'Unknown error' })
                .send(res)
        }
    }
}

export default new EmbeddingController()