import { ListObjectsCommand, PutObjectCommand } from "@aws-sdk/client-s3"
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import s3Client from "../providers/s3.connect"
import { S3_BUCKET_NAME, CLOUDFRONT_URL } from "../config/env"


export class S3Service {
    async uploadFile(key: string, body: Buffer, contentType: string) {
        const command = new PutObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: key,
            Body: body,
            ContentType: contentType,
        })
        await s3Client.send(command)
        return this.getCloudFrontUrl(key)
    }

    async uploadMultipleFiles(files: { key: string, body: Buffer, contentType: string }[]) {
        const uploadPromises = files.map(async file => {
            await this.uploadFile(file.key, file.body, file.contentType)
            return {
                key: file.key,
                url: this.getCloudFrontUrl(file.key)
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
            url: this.getCloudFrontUrl(obj.Key!)
        })) || []
    }
    getCloudFrontUrl(key: string): string {
        return `${CLOUDFRONT_URL}/${key}`
    }
}

export default new S3Service