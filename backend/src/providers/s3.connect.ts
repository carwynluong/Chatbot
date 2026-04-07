import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3"
import { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } from "../config/env"

export class S3Service {
    private static instance: S3Service
    private s3Client: S3Client

    private constructor() {
        this.s3Client = new S3Client({
            region: AWS_REGION,
            credentials: {
                accessKeyId: AWS_ACCESS_KEY_ID!,
                secretAccessKey: AWS_SECRET_ACCESS_KEY!
            }
        })
    }

    static getInstance(): S3Service {
        if (!S3Service.instance) {
            S3Service.instance = new S3Service()
        }
        return S3Service.instance
    }

    getS3Client(): S3Client {
        return this.s3Client
    }

    async healthCheck(): Promise<boolean> {
        try {
            const command = new ListBucketsCommand({})
            await this.s3Client.send(command)
            // console.log('S3 connection successful')
            return true
        } catch (error) {
            console.error('❌ S3 connection failed:', error)
            return false
        }
    }
}

export default S3Service.getInstance()