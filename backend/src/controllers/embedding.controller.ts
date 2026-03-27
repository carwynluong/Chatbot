import { Request, Response } from 'express'
import embeddingService from '../services/embedding.service'
import statusCodes from '../constants/statusCodes'
import S3Service from '../services/uploads.service'

export const processFileEmbedding = async (req: Request, res: Response) => {
    try {
        const { fileKey, fileKeys, fileName } = req.body
        if (fileKeys && Array.isArray(fileKeys)) {
            // Xu ly nhieu file 
            if (fileKeys.length === 0) {
                return res.status(statusCodes.BAD_REQUEST).json({
                    error: 'fileKeys array cannot be empty'
                })
            }
            const fileUrls = fileKeys.map(key => ({
                key,
                url: S3Service.getCloudFrontUrl(key)
            }))

            await embeddingService.processMultipleFilesDirect(fileUrls)
            res.status(statusCodes.OK).json({
                message: `${fileKeys.length} files processed and embeddings saved successfully`
            })
        } else if (fileKey) {
            const name = fileName || fileKey
            const cloudFrontUrl = S3Service.getCloudFrontUrl(fileKey)
            await embeddingService.processFileDirect(name, cloudFrontUrl)
            res.status(statusCodes.OK).json({
                message: `File ${fileKey} processed and embeddings saved successfully`
            })
        } else {
            return res.status(statusCodes.BAD_REQUEST).json({
                message: 'fileKey orr fileKeys is required'
            })
        }
    } catch (error) {
        console.log(`Error processing file embedding: ${error}`)
        res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to process file embedding'
        })
    }
}

export const initializePinecone = async (req: Request, res: Response) => {
    try {
        const isHealthy = await embeddingService.healthCheck()
        if (isHealthy) {
            res.status(200).json({
                message: 'Pinecone connection healthy',
                status: 'connected'
            })
        } else {
            res.status(500).json({
                message: 'Pinecone connection failed',
                status: 'disconnected'
            })
        }
    } catch (error) {
        console.error('Error checking Pinecone connection:', error)
        res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to check Pinecone connection',
            details: error instanceof Error ? error.message : 'Unknown error'
        })
    }
}