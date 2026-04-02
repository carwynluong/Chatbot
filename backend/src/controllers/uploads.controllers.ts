import { Request, Response } from "express"
import S3Service from "../services/uploads.service"
import statusCodes from "../constants/statusCodes"

export class S3Controller {
    async uploadMultipleFiles(req: Request, res: Response) {
        try {
            const files = req.files as Express.Multer.File[]


            if (!files || files.length === 0) {
                return res.status(400).json({ message: 'No files provided' })
            }

            const uploadData = files.map(file => ({
                key: `uploads/${Date.now()}-${file.originalname}`,
                body: file.buffer,
                contentType: file.mimetype
            }))

            const results = await S3Service.uploadMultipleFiles(uploadData)

            res.json({
                message: `${files.length} File uploaded successfully`,
                files: results
            })
        } catch (error) {
            console.error('Error in uploadFile controller:', error)
            res.status(statusCodes.INTERNAL_SERVER_ERROR).json({ 
                message: 'Upload failed', 
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    // async getUploadUrl(req: Request, res: Response) {
    //     try {
    //         const { filename } = req.body
    //         if (!filename ) {
    //             return res.status(statusCodes.BAD_REQUEST).json({ message: 'filename and contentType are required' })
    //         }

    //         const key = `uploads/${Date.now()}-${filename}`
    //         const uploadUrl = await S3Service.getPresignedUploadUrl(key)
    //         const accessUrl = S3Service.getS3Url(key)

    //         res.status(statusCodes.OK).json({
    //             message: 'Presigned URL generated successfully',
    //             uploadUrl,
    //             accessUrl,
    //             key
    //         })
    //     } catch (error) {
    //         console.error('Error in getUploadUrl controller:', error)
    //         res.status(statusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to generate presigned URL', error })
    //     }
    // }

    async listFiles(req: Request, res: Response) {
        try {
            const files = await S3Service.listFiles()
            res.status(statusCodes.OK).json({
                message: 'Files listed successfully',
                files
            })
        } catch (error) {
            console.error('Error in listFiles controller:', error)
            res.status(statusCodes.INTERNAL_SERVER_ERROR).json({ 
                message: 'Failed to list files', 
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    async getFileUrl(req: Request, res: Response) {
        try {
            const { key } = req.params
            const url = await S3Service.getPresignedDownloadUrl(key)
            res.status(statusCodes.OK).json({
                message: 'Presigned download URL generated successfully',
                url
            })
        } catch (error) {
            console.error('Error in getFileUrl controller:', error)
            res.status(statusCodes.INTERNAL_SERVER_ERROR).json({ 
                message: 'Failed to get file URL', 
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    async deleteFile(req: Request, res: Response) {
        try {
            const { key } = req.params
            await S3Service.deleteFile(key)
            res.status(statusCodes.OK).json({
                message: 'File deleted successfully'
            })
        } catch (error) {
            console.error('Error in deleteFile controller:', error)
            res.status(statusCodes.INTERNAL_SERVER_ERROR).json({ 
                message: 'Failed to delete file', 
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }
}


export default new S3Controller()