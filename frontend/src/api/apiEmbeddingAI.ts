import axios from '../lib/axios'
import type { EmbeddingResponse } from '../interfaces'


export class ApiEmbeddingAI {
    async processFiles(fileKeys: string[]): Promise<EmbeddingResponse> {
        const res = await axios.post<EmbeddingResponse>('/embedding/process', {
            fileKeys
        })
        return res.data
    }

    async initializeDatabase(): Promise<EmbeddingResponse> {
        const res = await axios.post<EmbeddingResponse>('/embedding/init-db')
        return res.data
    }
}

export default new ApiEmbeddingAI()