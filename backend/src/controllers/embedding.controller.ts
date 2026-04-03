import { Request, Response } from 'express'
import statusCodes from '../constants/statusCodes'
import embeddingService from '../services/embedding.service'
import s3Service from '../services/uploads.service'
import documentService from '../services/document.service'

export const processFileEmbedding = async (req: Request, res: Response) => {
    try {
        // console.log('Processing file embeddings...')
        // console.log('Embedding service type:', typeof embeddingService)
        // console.log('S3 service type:', typeof s3Service)
        
        const { fileKeys } = req.body
        
        // console.log('Received fileKeys:', fileKeys)
        
        if (!fileKeys || !Array.isArray(fileKeys) || fileKeys.length === 0) {
            console.log('Invalid fileKeys')
            return res.status(statusCodes.BAD_REQUEST).json({
                success: false,
                message: 'fileKeys array is required'
            })
        }
        
        // Convert file keys to URLs
        // console.log('Converting file keys to URLs...')
        const fileUrls = fileKeys.map(key => {
            const url = s3Service.getS3Url(key)
            console.log(`  ${key} -> ${url}`)
            return { key: key, url: url }
        })
        
        // console.log(`Processing ${fileUrls.length} files:`)
        // fileUrls.forEach(f => console.log(`  - ${f.key}`))
        
        // Process files through embedding service
        // console.log('Calling embedding service...')
        await embeddingService.processMultipleFilesDirect(fileUrls)
        // console.log('Embedding service completed')
        
        console.log('Files processed successfully')
        
        res.status(statusCodes.OK).json({
            success: true,
            message: `Successfully processed ${fileUrls.length} files`,
            filesProcessed: fileKeys,
            timestamp: new Date()
        })
        
    } catch (error) {
        console.error('❌ Embedding processing error:', error)
        res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to process embeddings',
            error: (error as Error).message
        })
    }
}

export const initializePinecone = async (req: Request, res: Response) => {
    try {
        const { Pinecone } = require('@pinecone-database/pinecone')
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        })
        
        const indexes = await pinecone.listIndexes()
        
        res.status(statusCodes.OK).json({
            success: true,
            message: 'Pinecone connection successful',
            indexes: indexes.indexes?.map((i: any) => i.name)
        })
        
    } catch (error) {
        console.error('❌ Pinecone initialization error:', error)
        res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Pinecone connection failed',
            error: (error as Error).message
        })
    }
}

export const getDocuments = async (req: Request, res: Response) => {
    try {
        // console.log('Getting all documents...')
        const documents = await documentService.getAllDocuments()
        
        // Get detailed status for each document
        const documentsWithDetails = documents.map(doc => ({
            id: doc.id,
            fileName: doc.fileName,
            status: doc.status,
            totalChunks: doc.totalChunks,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            errorMessage: doc.errorMessage,
            isReady: doc.status === 'embedded' && doc.totalChunks > 0
        }))
        
        const readyFiles = documentsWithDetails.filter(doc => doc.isReady).length
        const processingFiles = documentsWithDetails.filter(doc => doc.status === 'processing').length
        const errorFiles = documentsWithDetails.filter(doc => doc.status === 'error').length
        
        res.status(statusCodes.OK).json({
            success: true,
            documents: documentsWithDetails,
            summary: {
                total: documents.length,
                ready: readyFiles,
                processing: processingFiles,
                error: errorFiles
            }
        })
    } catch (error) {
        console.error('❌ Error getting documents:', error)
        res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get documents',
            error: error instanceof Error ? error.message : 'Unknown error'
        })
    }
}

export const testEmbedding = async (req: Request, res: Response) => {
    try {
        const { text } = req.body
        // console.log(`Testing embedding generation for: "${text?.substring(0, 50)}..."`)
        
        if (!text) {
            return res.status(statusCodes.BAD_REQUEST).json({
                success: false,
                message: 'text is required'
            })
        }

        const embedding = await embeddingService.generateEmbedding(text)
        // console.log(`Generated embedding: ${embedding.length} dimensions`)
        
        res.status(statusCodes.OK).json({
            success: true,
            embedding: embedding,
            dimensions: embedding.length
        })
    } catch (error) {
        console.error('❌ Error generating embedding:', error)
        res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to generate embedding'
        })
    }
}

export const queryPinecone = async (req: Request, res: Response) => {
    try {
        const { embedding, topK = 5 } = req.body
        // console.log(`Testing Pinecone query with ${embedding?.length} dimensional vector, topK: ${topK}`)
        
        if (!embedding || !Array.isArray(embedding)) {
            return res.status(statusCodes.BAD_REQUEST).json({
                success: false,
                message: 'embedding array is required'
            })
        }

        const matches = await embeddingService.querySimilarDocuments(embedding, topK)
        // console.log(`Found ${matches.length} similar documents`)
        
        res.status(statusCodes.OK).json({
            success: true,
            matches: matches,
            count: matches.length
        })
    } catch (error) {
        console.error('❌ Error querying Pinecone:', error)
        res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to query Pinecone'
        })
    }
}

export const testSearch = async (req: Request, res: Response) => {
    try {
        const { question } = req.body
        // console.log(`Testing search for question: "${question}"`)
        
        if (!question) {
            return res.status(statusCodes.BAD_REQUEST).json({
                success: false,
                message: 'question is required'
            })
        }

        // Generate embedding for the question
        const questionEmbedding = await embeddingService.generateEmbedding(question)
        // console.log(`Generated question embedding: ${questionEmbedding.length} dimensions`)
        
        // Search for similar chunks
        const matches = await embeddingService.querySimilarDocuments(questionEmbedding, 5)
        // console.log(`Found ${matches.length} relevant chunks`)
        
        const resultsWithContent = matches.map((match, index) => ({
            rank: index + 1,
            score: match.score,
            documentId: match.metadata?.documentId,
            fileName: match.metadata?.fileName,
            chunkIndex: match.metadata?.chunkIndex,
            content: match.metadata?.content || 'No content available',
            contentPreview: (match.metadata?.content || '').substring(0, 200) + '...'
        }))
        
        res.status(statusCodes.OK).json({
            success: true,
            question: question,
            totalMatches: matches.length,
            results: resultsWithContent
        })
    } catch (error) {
        console.error('❌ Error testing search:', error)
        res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to test search',
            error: error instanceof Error ? error.message : 'Unknown error'
        })
    }
}