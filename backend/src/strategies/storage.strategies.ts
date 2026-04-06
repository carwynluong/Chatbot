import { IFileStorageStrategy, IVectorStorageStrategy } from "../interfaces/IStrategy"
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
import s3Client from "../providers/s3.connect"
import { S3_BUCKET_NAME, AWS_REGION } from "../config/env"
import pineconeService from "../providers/pinecone.connect"
import { PINECONE_INDEX_NAME } from "../config/env"

export class S3StorageStrategy implements IFileStorageStrategy {
    private bucketName = S3_BUCKET_NAME!

    async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
        try {
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: buffer,
                ContentType: contentType,
            })
            await s3Client.send(command)
            return this.getUrl(key)
        } catch (error) {
            console.error(`S3 Upload error for key ${key}:`, error)
            throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async download(key: string): Promise<Buffer> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            })
            const response = await s3Client.send(command)
            
            if (!response.Body) {
                throw new Error('No file content received')
            }
            
            // Convert stream to buffer
            const chunks: Buffer[] = []
            const stream = response.Body as NodeJS.ReadableStream
            
            return new Promise((resolve, reject) => {
                stream.on('data', (chunk: Buffer) => chunks.push(chunk))
                stream.on('error', reject)
                stream.on('end', () => resolve(Buffer.concat(chunks)))
            })
        } catch (error) {
            console.error(`S3 Download error for key ${key}:`, error)
            throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    async delete(key: string): Promise<void> {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key
            })
            await s3Client.send(command)
        } catch (error) {
            console.error(`S3 Delete error for key ${key}:`, error)
            throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    getUrl(key: string): string {
        return `https://${this.bucketName}.s3.${AWS_REGION}.amazonaws.com/${key}`
    }

    async exists(key: string): Promise<boolean> {
        try {
            await s3Client.send(new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key
            }))
            return true
        } catch {
            return false
        }
    }
}

export class PineconeStorageStrategy implements IVectorStorageStrategy {
    private indexName = PINECONE_INDEX_NAME!

    async upsert(vectors: Array<{id: string, values: number[], metadata?: any}>): Promise<void> {
        try {
            const index = await pineconeService.getIndex(this.indexName)
            
            // Process in batches of 100
            const batchSize = 100
            for (let i = 0; i < vectors.length; i += batchSize) {
                const batch = vectors.slice(i, i + batchSize)
                await index.upsert(batch)
                console.log(`✅ Upserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(vectors.length/batchSize)} (${batch.length} vectors)`)
            }
        } catch (error) {
            console.error('Pinecone upsert error:', error)
            throw new Error(`Failed to upsert vectors: ${error}`)
        }
    }

    async query(vector: number[], topK: number = 5): Promise<Array<{id: string, score: number, metadata?: any}>> {
        try {
            const index = await pineconeService.getIndex(this.indexName)
            const queryResponse = await index.query({
                vector,
                topK,
                includeMetadata: true,
                includeValues: false
            })
            
            return queryResponse.matches?.map(match => ({
                id: match.id || '',
                score: match.score || 0,
                metadata: match.metadata
            })) || []
        } catch (error) {
            console.error('Pinecone query error:', error)
            throw new Error(`Failed to query vectors: ${error}`)
        }
    }

    async delete(ids: string[]): Promise<void> {
        try {
            const index = await pineconeService.getIndex(this.indexName)
            await index.deleteOne(ids)
        } catch (error) {
            console.error('Pinecone delete error:', error)
            throw new Error(`Failed to delete vectors: ${error}`)
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            return await pineconeService.healthCheck()
        } catch {
            return false
        }
    }
}