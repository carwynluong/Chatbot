// Strategy Pattern Interfaces

export interface IAIStrategy {
    generateResponse(prompt: string): Promise<string>
    generateEmbedding(text: string): Promise<number[]>
    streamResponse(prompt: string): AsyncIterable<string>
}

export interface IDocumentProcessor {
    canProcess(fileType: string): boolean
    extractText(buffer: Buffer): Promise<string>
    getSupportedTypes(): string[]
}

export interface IFileStorageStrategy {
    upload(key: string, buffer: Buffer, contentType: string): Promise<string>
    download(key: string): Promise<Buffer>
    delete(key: string): Promise<void>
    getUrl(key: string): string
    exists(key: string): Promise<boolean>
}

export interface IVectorStorageStrategy {
    upsert(vectors: Array<{id: string, values: number[], metadata?: any}>): Promise<void>
    query(vector: number[], topK: number): Promise<Array<{id: string, score: number, metadata?: any}>>
    delete(ids: string[]): Promise<void>
    healthCheck(): Promise<boolean>
}