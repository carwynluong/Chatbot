import { Request, Response } from 'express'
import statusCodes from '../constants/statusCodes'

export const processFileEmbedding = async (req: Request, res: Response) => {
    try {
        console.log('🧪 Embedding endpoint called - using working credentials')
        
        const { Pinecone } = require('@pinecone-database/pinecone')
        
        // Use working API key directly for now
        const pinecone = new Pinecone({
            apiKey: 'pcsk_48gGSh_4ym69DQqNK4s9ruvq2Ekm9y8P3HGphgSqcywuc8KVfuNfq7MQ3YB47nu3RHX4Hg'
        })
        
        const index = pinecone.index('first-project')
        const stats = await index.describeIndexStats()
        
        // Create test vector  
        const mockVector = Array.from({length: 1536}, () => Math.random() - 0.5)
        const vectorId = 'embedding-api-' + Date.now()
        
        await index.upsert([{
            id: vectorId,
            values: mockVector,
            metadata: {
                content: 'Test embedding from API',
                fileName: req.body.fileKey || 'test-file.txt',
                timestamp: new Date().toISOString(),
                source: 'embedding-controller'
            }
        }])
        
        console.log('✅ Embedding stored successfully:', vectorId)
        
        // Clean up after 10 seconds
        setTimeout(() => {
            index.deleteOne(vectorId).catch(console.error)
        }, 10000)
        
        res.status(statusCodes.OK).json({
            success: true,
            message: 'Embedding test successful! Pinecone is working!',
            vectorId,
            stats: {
                dimension: stats.dimension,
                totalVectors: stats.totalVectorCount || 0
            },
            timestamp: new Date()
        })
        
    } catch (error) {
        console.error('❌ Embedding error:', error)
        res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Embedding failed',
            error: (error as Error).message
        })
    }
}

export const initializePinecone = async (req: Request, res: Response) => {
    try {
        const { Pinecone } = require('@pinecone-database/pinecone')
        const pinecone = new Pinecone({
            apiKey: 'pcsk_48gGSh_4ym69DQqNK4s9ruvq2Ekm9y8P3HGphgSqcywuc8KVfuNfq7MQ3YB47nu3RHX4Hg'
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