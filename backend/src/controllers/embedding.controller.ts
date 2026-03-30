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
            const fileUrls = await Promise.all(fileKeys.map(async key => ({
                key,
                url: await S3Service.getPresignedDownloadUrl(key, 3600)
            })))

            await embeddingService.processMultipleFilesDirect(fileUrls)
            res.status(statusCodes.OK).json({
                message: `${fileKeys.length} files processed and embeddings saved successfully`
            })
        } else if (fileKey) {
            const name = fileName || fileKey
            const signedUrl = await S3Service.getPresignedDownloadUrl(fileKey, 3600) // 1 hour expiry
            await embeddingService.processFileDirect(name, signedUrl)
            res.status(statusCodes.OK).json({
                message: `File ${fileKey} processed and embeddings saved successfully`
            })
        } else {
            return res.status(statusCodes.BAD_REQUEST).json({
                message: 'fileKey orr fileKeys is required'
            })
        }
    } catch (error) {
        console.error('❌ Full error details:', error)
        console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error)
        if (error instanceof Error) {
            console.error('❌ Error message:', error.message)
            console.error('❌ Error stack:', error.stack)
        }
        
        // Check if it's an axios error
        if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as any
            console.error('❌ Axios error status:', axiosError.response?.status)
            console.error('❌ Axios error data:', axiosError.response?.data)
            console.error('❌ Axios config URL:', axiosError.config?.url)
        }
        
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