import axios from '../lib/axios'
import type { EmbeddingResponse } from '../interfaces'


export class ApiEmbeddingAI {
    async processFiles(fileKeys: string[]): Promise<EmbeddingResponse> {
        console.log('📤 API: Processing multiple files:', fileKeys)
        try {
            const res = await axios.post<EmbeddingResponse>('/embedding/process', {
                fileKeys
            })
            console.log('✅ API: Batch processing response:', res.data)
            return res.data
        } catch (error) {
            console.error('❌ API: Batch processing error:', error)
            throw error
        }
    }

    async createEmbedding(fileKey: string): Promise<EmbeddingResponse> {
        console.log('📤 API: Processing single file:', fileKey)
        try {
            const res = await axios.post<EmbeddingResponse>('/embedding/process', {
                fileKeys: [fileKey]  // Convert to array to match API
            })
            console.log('✅ API: Single file processing response:', res.data)
            return res.data
        } catch (error) {
            console.error('❌ API: Single file processing error:', error)
            throw error
        }
    }

    async initializeDatabase(): Promise<EmbeddingResponse> {
        const res = await axios.post<EmbeddingResponse>('/embedding/init-db')
        return res.data
    }
}

export default new ApiEmbeddingAI()