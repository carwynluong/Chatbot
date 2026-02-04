import { Request, Response } from 'express'
import { EmbeddingService } from '../services/embedding.service'
import statusCodes from '../constants/statusCodes'
import S3Service from '../services/uploads.service'
const embeddingService = new EmbeddingService()

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

export const initializeDatabase = async (req: Request, res: Response) => {
    try {
        await embeddingService.initializeDatabase()
        res.status(200).json({
            message: 'Database initialized successfully'
        })
    } catch (error) {
        console.error('Error in initializeDatabase controller:', error)
        res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to initialize database'
        })
    }
}