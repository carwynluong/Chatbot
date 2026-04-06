import { IFileStorageStrategy } from '../interfaces/IStrategy'
import { S3StorageStrategy } from '../strategies/storage.strategies'
import { UploadFileCommand, commandManager } from '../utils/commands'
import { eventManager } from '../utils/event.manager'
import { ResponseBuilder } from '../utils/builders'
import { ErrorFactory } from '../utils/pattern.factories'

export interface UploadFileData {
    key: string
    body: Buffer
    contentType: string
    originalName?: string
}

export interface UploadResult {
    key: string
    url: string
    originalName?: string
}

export class UploadsService {
    private fileStorage: IFileStorageStrategy
    private errorFactory: ErrorFactory

    constructor() {
        this.fileStorage = new S3StorageStrategy()
        this.errorFactory = new ErrorFactory()
    }

    async uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
        try {
            // Create and execute upload command
            const uploadCommand = new UploadFileCommand(
                key,
                body,
                contentType,
                this.fileStorage
            )

            return await commandManager.execute(uploadCommand)
        } catch (error) {
            console.error(`❌ Upload error for key ${key}:`, error)
            throw this.errorFactory.createInternalError(
                `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error as Error
            )
        }
    }

    async uploadMultipleFiles(files: UploadFileData[]): Promise<UploadResult[]> {
        console.log(`📤 Uploading ${files.length} files...`)

        try {
            // Create upload commands for all files
            const uploadCommands = files.map(file => 
                new UploadFileCommand(
                    file.key,
                    file.body,
                    file.contentType,
                    this.fileStorage
                )
            )

            // Execute all uploads concurrently
            const uploadPromises = uploadCommands.map(async (command, index) => {
                try {
                    const url = await commandManager.execute(command)
                    return {
                        key: files[index].key,
                        url: url,
                        originalName: files[index].originalName
                    }
                } catch (error) {
                    console.error(`❌ Failed to upload file ${files[index].key}:`, error)
                    throw error
                }
            })

            const results = await Promise.all(uploadPromises)
            
            console.log(`✅ Successfully uploaded ${results.length} files`)
            return results

        } catch (error) {
            console.error('❌ Multiple file upload error:', error)
            throw this.errorFactory.createInternalError(
                'Failed to upload multiple files',
                error as Error
            )
        }
    }
    
    async getFileUrl(key: string): Promise<string> {
        try {
            return this.fileStorage.getUrl(key)
        } catch (error) {
            console.error(`❌ Error getting URL for key ${key}:`, error)
            throw this.errorFactory.createInternalError(
                `Failed to get file URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error as Error
            )
        }
    }

    getS3Url(key: string): string {
        return this.fileStorage.getUrl(key)
    }

    async deleteFile(key: string): Promise<void> {
        try {
            await this.fileStorage.delete(key)
            console.log(`🗑️ Deleted file: ${key}`)

            await eventManager.notify('file.delete.completed', { 
                key 
            })

        } catch (error) {
            console.error(`❌ Error deleting file ${key}:`, error)
            
            await eventManager.notify('file.delete.failed', { 
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            })

            throw this.errorFactory.createInternalError(
                `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error as Error
            )
        }
    }

    async deleteMultipleFiles(keys: string[]): Promise<void> {
        console.log(`🗑️ Deleting ${keys.length} files...`)

        try {
            const deletePromises = keys.map(key => this.deleteFile(key))
            await Promise.allSettled(deletePromises)
            
            console.log(`✅ Completed deletion of ${keys.length} files`)
        } catch (error) {
            console.error('❌ Multiple file deletion error:', error)
            throw this.errorFactory.createInternalError(
                'Failed to delete multiple files',
                error as Error
            )
        }
    }

    async fileExists(key: string): Promise<boolean> {
        try {
            return await this.fileStorage.exists(key)
        } catch (error) {
            console.error(`❌ Error checking file existence ${key}:`, error)
            return false
        }
    }

    async downloadFile(key: string): Promise<Buffer> {
        try {
            console.log(`📥 Downloading file: ${key}`)
            
            const buffer = await this.fileStorage.download(key)
            
            console.log(`✅ Downloaded file: ${key} (${buffer.length} bytes)`)
            return buffer

        } catch (error) {
            console.error(`❌ Error downloading file ${key}:`, error)
            throw this.errorFactory.createInternalError(
                `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error as Error
            )
        }
    }

    // Helper method to generate unique file keys
    generateFileKey(originalName: string, prefix: string = 'uploads'): string {
        // Sanitize filename for S3
        const sanitizedName = Buffer.from(originalName, 'utf8')
            .toString('ascii', 0, Buffer.byteLength(originalName, 'utf8'))
            .replace(/[^\w\s.-]/g, '_')
            .replace(/\s+/g, '_')
        
        const timestamp = Date.now()
        return `${prefix}/${timestamp}-${sanitizedName}`
    }

    // Strategy pattern support
    setStorageStrategy(storage: IFileStorageStrategy): void {
        this.fileStorage = storage
        console.log('🔄 File storage strategy updated')
    }

    // Convenience methods for creating upload data
    static createUploadData(
        key: string, 
        buffer: Buffer, 
        contentType: string, 
        originalName?: string
    ): UploadFileData {
        return { key, body: buffer, contentType, originalName }
    }

    static createMultipleUploadData(
        files: Array<{buffer: Buffer, contentType: string, originalName: string}>,
        prefix: string = 'uploads'
    ): UploadFileData[] {
        return files.map(file => {
            const service = new UploadsService()
            const key = service.generateFileKey(file.originalName, prefix)
            
            return {
                key,
                body: file.buffer,
                contentType: file.contentType,
                originalName: file.originalName
            }
        })
    }
}

export default new UploadsService()