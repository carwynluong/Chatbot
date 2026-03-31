import { ListObjectsCommand, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import s3Client from "../providers/s3.connect"
import { S3_BUCKET_NAME, AWS_REGION } from "../config/env"


export class S3Service {
    async uploadFile(key: string, body: Buffer, contentType: string) {
        try {
            const command = new PutObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: key,
                Body: body,
                ContentType: contentType,
            })
            await s3Client.send(command)
            return this.getS3Url(key)
        } catch (error) {
            console.error(`S3 Upload error for key ${key}:`, error)
            throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async uploadMultipleFiles(files: { key: string, body: Buffer, contentType: string }[]) {
        const uploadPromises = files.map(async file => {
            await this.uploadFile(file.key, file.body, file.contentType)
            return {
                key: file.key,
                url: this.getS3Url(file.key)
            }
        })
        return await Promise.all(uploadPromises)
    }

    // async getPresignedUploadUrl(key: string, expiresIn = 3600) {
    //     const command = new PutObjectCommand({
    //         Bucket: S3_BUCKET_NAME,
    //         Key: key,
    //     })
    //     return await getSignedUrl(s3Client, command, { expiresIn })
    // }
    async listFiles() {
        const command = new ListObjectsCommand({
            Bucket: S3_BUCKET_NAME
        })
        const res = await s3Client.send(command)

        return res.Contents?.map(obj => ({
            key: obj.Key,
            size: obj.Size,
            lastModified: obj.LastModified,
            url: this.getS3Url(obj.Key!)
        })) || []
    }

    async deleteFile(key: string) {
        const command = new DeleteObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: key
        })
        await s3Client.send(command)
        return true
    }
    async getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
        try {
            const command = new GetObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: key,
            })
            return await getSignedUrl(s3Client, command, { expiresIn })
        } catch (error) {
            console.error(`Error creating presigned download URL for ${key}:`, error)
            throw new Error(`Failed to create download URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }
    
    getS3Url(key: string): string {
        const region = AWS_REGION || 'us-east-1'
        return `https://${S3_BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`
    }
}

export default new S3Service