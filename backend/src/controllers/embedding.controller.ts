import { Request, Response } from 'express'
import statusCodes from '../constants/statusCodes'
import embeddingService from '../services/embedding.service'
import s3Service from '../services/uploads.service'

export const processFileEmbedding = async (req: Request, res: Response) => {
    try {
        console.log('🚀 Processing file embeddings...')
        console.log('📦 Embedding service:', typeof embeddingService)
        console.log('📦 S3 service:', typeof s3Service)
        
        const { fileKeys } = req.body
        
        console.log('📂 Received fileKeys:', fileKeys)
        
        if (!fileKeys || !Array.isArray(fileKeys) || fileKeys.length === 0) {
            console.log('❌ Invalid fileKeys')
            return res.status(statusCodes.BAD_REQUEST).json({
                success: false,
                message: 'fileKeys array is required'
            })
        }
        
        // Convert file keys to URLs
        console.log('🔗 Converting file keys to URLs...')
        const fileUrls = fileKeys.map(key => {
            const url = s3Service.getS3Url(key)
            console.log(`  ${key} -> ${url}`)
            return { key: key, url: url }
        })
        
        console.log(`📂 Processing ${fileUrls.length} files:`)
        fileUrls.forEach(f => console.log(`  - ${f.key}`))
        
        // Process files through embedding service
        console.log('🔄 Calling embedding service...')
        await embeddingService.processMultipleFilesDirect(fileUrls)
        console.log('✅ Embedding service completed')
        
        console.log('✅ All files processed successfully')
        
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
        console.log('📊 Getting all documents from database...')
        const documents = await documentService.getAllDocuments()
        
        res.status(statusCodes.OK).json({
            success: true,
            documents: documents,
            count: documents.length
        })
    } catch (error) {
        console.error('❌ Error getting documents:', error)
        res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get documents'
        })
    }
}

export const testEmbedding = async (req: Request, res: Response) => {
    try {
        const { text } = req.body
        console.log(`🧠 Testing embedding generation for: "${text?.substring(0, 50)}..."`)
        
        if (!text) {
            return res.status(statusCodes.BAD_REQUEST).json({
                success: false,
                message: 'text is required'
            })
        }

        const embedding = await embeddingService.generateEmbedding(text)
        console.log(`✅ Generated embedding: ${embedding.length} dimensions`)
        
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
        console.log(`🎯 Testing Pinecone query with ${embedding?.length} dimensional vector, topK: ${topK}`)
        
        if (!embedding || !Array.isArray(embedding)) {
            return res.status(statusCodes.BAD_REQUEST).json({
                success: false,
                message: 'embedding array is required'
            })
        }

        const matches = await embeddingService.querySimilarDocuments(embedding, topK)
        console.log(`🔍 Found ${matches.length} similar documents`)
        
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