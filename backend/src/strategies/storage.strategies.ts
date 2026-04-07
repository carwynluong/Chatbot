import { IFileStorageStrategy, IVectorStorageStrategy } from "../interfaces/IStrategy"
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3"
import s3Service from "../providers/s3.connect"
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
            await s3Service.getS3Client().send(command)
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
            const response = await s3Service.getS3Client().send(command)
            
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
            await s3Service.getS3Client().send(command)
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
            await s3Service.getS3Client().send(new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key
            }))
            return true
        } catch {
            return false
        }
    }

    async listObjects(prefix?: string): Promise<Array<{key: string, size: number, lastModified: Date}>> {
        try {
            const command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: prefix
            })

            const response = await s3Service.getS3Client().send(command)
            const objects = response.Contents || []

            return objects.map(obj => ({
                key: obj.Key!,
                size: obj.Size || 0,
                lastModified: obj.LastModified || new Date()
            }))
        } catch (error) {
            console.error('S3 ListObjects error:', error)
            throw new Error(`Failed to list objects: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
            console.log('🟡 Pinecone Query Debug:')
            console.log(`   Index: ${this.indexName}`)
            console.log(`   Vector dimension: ${vector.length}`)
            console.log(`   TopK: ${topK}`)
            
            const index = await pineconeService.getIndex(this.indexName)
            const queryResponse = await index.query({
                vector,
                topK,
                includeMetadata: true,
                includeValues: false
            })
            
            console.log('✅ Query successful, results:', queryResponse.matches?.length)
            
            return queryResponse.matches?.map(match => ({
                id: match.id || '',
                score: match.score || 0,
                metadata: match.metadata
            })) || []
        } catch (error) {
            console.error('❌ Pinecone query error details:')
            console.error('   Index:', this.indexName)
            console.error('   Vector dimension:', vector.length)
            console.error('   Error type:', typeof error)
            console.error('   Error message:', (error as any)?.message)
            console.error('   Full error:', error)
            throw new Error(`Failed to query vectors: ${error}`)
        }
    }

    async delete(ids: string[]): Promise<void> {
        try {
            const index = await pineconeService.getIndex(this.indexName)
            await index.deleteMany(ids)
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