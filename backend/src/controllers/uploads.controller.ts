import { Request, Response } from "express"
import uploadsService, { UploadsService } from "../services/uploads.service"
import embeddingService from "../services/embedding.service"
import { ResponseBuilder } from "../utils/builders"
import { ErrorFactory } from "../utils/pattern.factories"
import statusCodes from "../constants/statusCodes"

export class UploadsController {
    private uploadsService: typeof uploadsService
    private embeddingService: typeof embeddingService
    private errorFactory: ErrorFactory

    constructor() {
        this.uploadsService = uploadsService
        this.embeddingService = embeddingService
        this.errorFactory = new ErrorFactory()
    }

    async uploadMultipleFiles(req: Request, res: Response) {
        try {
            const files = req.files as Express.Multer.File[]

            if (!files || files.length === 0) {
                return ResponseBuilder.validation('No files provided')
                    .send(res)
            }

            console.log(`📤 Uploading ${files.length} files...`)

            // Prepare upload data
            const uploadDataArray = files.map(file => {
                const key = this.uploadsService.generateFileKey(file.originalname)
                
                return UploadsService.createUploadData(
                    key,
                    file.buffer,
                    file.mimetype,
                    file.originalname
                )
            })

            // Upload all files
            const uploadResults = await this.uploadsService.uploadMultipleFiles(uploadDataArray)

            // Automatically trigger embedding processing for uploaded files
            console.log('� Files uploaded successfully, manual embedding required')
            
            // Return success response without auto-embedding
            ResponseBuilder.success({
                files: uploadResults,
                count: uploadResults.length,
                embeddingStatus: 'not_processed'
            }, `Successfully uploaded ${uploadResults.length} files - use embedding endpoint to process`)
                .setStatus(statusCodes.CREATED)
                .send(res)

        } catch (error) {
            console.error('❌ Error uploading files:', error)
            
            ResponseBuilder.error('Failed to upload files')
                .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
                .setData({ error: error instanceof Error ? error.message : 'Unknown error' })
                .send(res)
        }
    }

    // async uploadSingleFile(req: Request, res: Response) {
    //     try {
    //         const file = req.file as Express.Multer.File

    //         if (!file) {
    //             return ResponseBuilder.validation('No file provided')
    //                 .send(res)
    //         }

    //         console.log(`📤 Uploading file: ${file.originalname}`)

    //         // Generate unique key and upload to S3 only
    //         const key = this.uploadsService.generateFileKey(file.originalname)
    //         const url = await this.uploadsService.uploadFile(key, file.buffer, file.mimetype)

    //         console.log('📁 File uploaded successfully, manual embedding required')

    //         ResponseBuilder.success({
    //             key,
    //             url,
    //             originalName: file.originalname,
    //             embeddingStatus: 'not_processed'
    //         }, 'File uploaded successfully - use embedding endpoint to process')
    //             .setStatus(statusCodes.CREATED)
    //             .send(res)

    //     } catch (error) {
    //         console.error('❌ Error uploading file:', error)
            
    //         ResponseBuilder.error('Failed to upload file')
    //             .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
    //             .send(res)
    //     }
    // }

    async getFileUrl(req: Request, res: Response) {
        try {
            // Handle both legacy :key and encoded :encodedKey patterns
            let key = req.params.key || req.params.encodedKey

            // If it's an encoded key, decode it from base64
            if (req.params.encodedKey) {
                try {
                    key = Buffer.from(req.params.encodedKey, 'base64').toString('utf-8')
                } catch (decodeError) {
                    console.error('❌ Error decoding key:', decodeError)
                    return ResponseBuilder.validation('Invalid encoded file key')
                        .send(res)
                }
            }

            if (!key) {
                return ResponseBuilder.validation('File key is required')
                    .send(res)
            }

            // Check if file exists
            const exists = await this.uploadsService.fileExists(key)
            
            if (!exists) {
                return ResponseBuilder.notFound('File', key)
                    .send(res)
            }

            const url = this.uploadsService.getS3Url(key)

            ResponseBuilder.success({
                key,
                url
            }, 'File URL retrieved successfully')
                .send(res)

        } catch (error) {
            console.error('❌ Error getting file URL:', error)
            
            ResponseBuilder.error('Failed to get file URL')
                .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
                .send(res)
        }
    }

    async deleteFile(req: Request, res: Response) {
        try {
            console.log('🔍 DELETE request received:', {
                originalUrl: req.originalUrl,
                params: req.params,
                method: req.method
            })

            // Handle both legacy :key and encoded :encodedKey patterns
            let key = req.params.key || req.params.encodedKey

            console.log('🔍 Raw key from params:', { key, encodedKey: req.params.encodedKey })

            // If it's an encoded key, decode it from base64
            if (req.params.encodedKey) {
                try {
                    const decoded = Buffer.from(req.params.encodedKey, 'base64').toString('utf-8')
                    key = decodeURIComponent(decoded)  // Double decode: base64 then URL decode
                    console.log('✅ Decoded key:', { 
                        base64Decoded: decoded, 
                        finalKey: key 
                    })
                } catch (decodeError) {
                    console.error('❌ Error decoding key:', decodeError)
                    return ResponseBuilder.validation('Invalid encoded file key')
                        .send(res)
                }
            }

            if (!key) {
                console.error('❌ No key provided')
                return ResponseBuilder.validation('File key is required')
                    .send(res)
            }

            // Check if file exists on S3
            const exists = await this.uploadsService.fileExists(key)
            
            if (!exists) {
                console.log(`❌ File not found on S3: ${key}`)
                return ResponseBuilder.notFound('File', key)
                    .send(res)
            }

            console.log(`🗑️ Deleting file from S3 only: ${key}`)

            // Delete file from S3 only (simplified logic)
            await this.uploadsService.deleteFile(key)
            
            console.log(`✅ Successfully deleted file from S3: ${key}`)

            ResponseBuilder.success({
                key,
                message: 'File deleted from S3 successfully'
            }, 'File deleted successfully')
                .send(res)

        } catch (error) {
            console.error('❌ Error deleting file:', error)
            
            ResponseBuilder.error('Failed to delete file')
                .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
                .send(res)
        }
    }

    // async downloadFile(req: Request, res: Response) {
    //     try {
    //         // Handle both legacy :key and encoded :encodedKey patterns
    //         let key = req.params.key || req.params.encodedKey

    //         // If it's an encoded key, decode it from base64
    //         if (req.params.encodedKey) {
    //             try {
    //                 key = Buffer.from(req.params.encodedKey, 'base64').toString('utf-8')
    //             } catch (decodeError) {
    //                 console.error('❌ Error decoding key:', decodeError)
    //                 return ResponseBuilder.validation('Invalid encoded file key')
    //                     .send(res)
    //             }
    //         }

    //         if (!key) {
    //             return ResponseBuilder.validation('File key is required')
    //                 .send(res)
    //         }

    //         // Check if file exists
    //         const exists = await this.uploadsService.fileExists(key)
            
    //         if (!exists) {
    //             return ResponseBuilder.notFound('File', key)
    //                 .send(res)
    //         }

    //         // Download file
    //         const buffer = await this.uploadsService.downloadFile(key)

    //         // Extract filename from key
    //         const filename = key.split('/').pop() || 'download'

    //         // Set appropriate headers
    //         res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    //         res.setHeader('Content-Type', 'application/octet-stream')
    //         res.setHeader('Content-Length', buffer.length.toString())

    //         // Send file buffer
    //         res.send(buffer)

    //     } catch (error) {
    //         console.error('❌ Error downloading file:', error)
            
    //         if (!res.headersSent) {
    //             ResponseBuilder.error('Failed to download file')
    //                 .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
    //                 .send(res)
    //         }
    //     }
    // }

    async listFiles(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            
            if (!userId) {
                return ResponseBuilder.unauthorized('User not authenticated')
                    .send(res)
            }

            console.log(`📄 Listing S3 files for user: ${userId}`)
            
            // Get all files from S3
            const s3Files = await this.uploadsService.listS3Objects('uploads')
            console.log(`📄 Found ${s3Files.length} files in S3`)
            
            // Get embedded files from database for status check
            const { default: documentService } = await import('../services/document.service')
            const dbDocuments = await documentService.getAllDocuments()
            const embeddedMap = new Map(dbDocuments.map(doc => [
                doc.s3Key || doc.id, 
                { isEmbedded: doc.status === 'embedded', ...doc }
            ]))
            
            // Combine S3 files with database status
            const files = s3Files.map(file => {
                const dbInfo = embeddedMap.get(file.key)
                return {
                    key: file.key,
                    size: file.size,
                    url: file.url,
                    lastModified: file.lastModified,
                    name: file.key.split('/').pop() || file.key,
                    isEmbedded: dbInfo?.isEmbedded || false,
                    status: dbInfo?.status || 'not_processed',
                    fileType: dbInfo?.fileType || null,
                    totalChunks: dbInfo?.totalChunks || 0
                }
            })
            
            console.log(`📊 Files processed: ${files.length}, Embedded: ${files.filter(f => f.isEmbedded).length}`)

            return ResponseBuilder.success({
                files: files,
                count: files.length,
                embedded: files.filter(f => f.isEmbedded).length
            }, 'S3 files with embedding status retrieved successfully')
                .send(res)

        } catch (error) {
            console.error('❌ Error listing files:', error)
            
            ResponseBuilder.error('Failed to list files')
                .setStatus(statusCodes.INTERNAL_SERVER_ERROR)
                .send(res)
        }
    }

    // Health check for upload service
    async healthCheck(req: Request, res: Response) {
        try {
            // Test file existence check (using a known non-existent file)
            const testKey = 'health-check-non-existent-file'
            await this.uploadsService.fileExists(testKey)

            ResponseBuilder.success({
                status: 'healthy',
                service: 'uploads'
            }, 'Upload service is healthy')
                .send(res)

        } catch (error) {
            console.error('❌ Upload service health check failed:', error)
            
            ResponseBuilder.error('Upload service is unhealthy')
                .setStatus(statusCodes.SERVICE_UNAVAILABLE || 503)
                .send(res)
        }
    }
}

export default new UploadsController()