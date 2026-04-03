import { Pinecone } from '@pinecone-database/pinecone'
import { PINECONE_API_KEY } from '../config/env'

export class PineconeService {
    private static instance: PineconeService
    private pinecone: Pinecone

    private constructor() {
        this.pinecone = new Pinecone({
            apiKey: PINECONE_API_KEY!
        })
    }

    static getInstance(): PineconeService {
        if (!PineconeService.instance) {
            PineconeService.instance = new PineconeService()
        }
        return PineconeService.instance
    }

    getPineconeClient(): Pinecone {
        return this.pinecone
    }

    async getIndex(indexName: string) {
        return this.pinecone.index(indexName)
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.pinecone.listIndexes()
            // console.log('Pinecone connection successful')
            return true
        } catch (error) {
            console.error('❌ Pinecone connection failed:', error)
            return false
        }
    }
}

export default PineconeService.getInstance()