import { ICommand, ICommandManager } from "../interfaces/IPatterns"
import { IFileStorageStrategy, IVectorStorageStrategy, IAIStrategy } from "../interfaces/IStrategy"
import { DocumentProcessorFactory } from "./pattern.factories"
import { eventManager } from "./event.manager"

export class CommandManager implements ICommandManager {
    private commandHistory: ICommand[] = []
    private currentIndex: number = -1

    async execute(command: ICommand): Promise<any> {
        if (command.canExecute && !command.canExecute()) {
            throw new Error('Command cannot be executed at this time')
        }

        const result = await command.execute()
        
        // Add to history if command supports undo
        if (command.undo) {
            this.commandHistory = this.commandHistory.slice(0, this.currentIndex + 1)
            this.commandHistory.push(command)
            this.currentIndex++
        }

        return result
    }

    async undo(): Promise<void> {
        if (!this.canUndo()) {
            throw new Error('No commands to undo')
        }

        const command = this.commandHistory[this.currentIndex]
        if (command.undo) {
            await command.undo()
            this.currentIndex--
        }
    }

    canUndo(): boolean {
        return this.currentIndex >= 0 && 
               this.currentIndex < this.commandHistory.length &&
               !!this.commandHistory[this.currentIndex].undo
    }

    getHistory(): ICommand[] {
        return [...this.commandHistory]
    }

    clearHistory(): void {
        this.commandHistory = []
        this.currentIndex = -1
    }
}

export class UploadFileCommand implements ICommand {
    constructor(
        private fileKey: string,
        private fileBuffer: Buffer,
        private contentType: string,
        private fileStorage: IFileStorageStrategy
    ) {}

    async execute(): Promise<string> {
        try {
            await eventManager.notify('file.upload.started', { 
                fileName: this.fileKey 
            })

            const url = await this.fileStorage.upload(this.fileKey, this.fileBuffer, this.contentType)
            
            await eventManager.notify('file.upload.completed', { 
                fileName: this.fileKey,
                s3Key: this.fileKey,
                url 
            })

            return url
        } catch (error) {
            await eventManager.notify('file.upload.failed', { 
                fileName: this.fileKey,
                error: error instanceof Error ? error.message : 'Unknown error'
            })
            throw error
        }
    }

    async undo(): Promise<void> {
        try {
            await this.fileStorage.delete(this.fileKey)
            console.log(`🗑️ Undid upload: ${this.fileKey}`)
        } catch (error) {
            console.error(`❌ Failed to undo upload for ${this.fileKey}:`, error)
        }
    }

    canExecute(): boolean {
        return this.fileBuffer && this.fileBuffer.length > 0
    }
}

export class ProcessEmbeddingCommand implements ICommand {
    constructor(
        private documentId: string,
        private fileContent: string,
        private fileName: string,
        private aiStrategy: IAIStrategy,
        private vectorStorage: IVectorStorageStrategy
    ) {}

    async execute(): Promise<void> {
        try {
            await eventManager.notify('embedding.processing.started', { 
                documentId: this.documentId 
            })

            // Split text into chunks
            console.log(`📋 Splitting text into chunks (length: ${this.fileContent.length})`)
            const { RecursiveCharacterTextSplitter } = await import('langchain/text_splitter')
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200
            })
            
            const chunks = await textSplitter.splitText(this.fileContent)
            const totalChunks = chunks.length

            // Process chunks in batches
            const vectors = []
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i]
                
                const embedding = await this.aiStrategy.generateEmbedding(chunk)
                
                vectors.push({
                    id: `${this.documentId}_chunk_${i}`,
                    values: embedding,
                    metadata: {
                        documentId: this.documentId,
                        chunkIndex: i,
                        content: chunk,
                        fileName: this.fileName,
                        totalChunks,
                        chunkNumber: i + 1
                    }
                })

                // Report progress
                const progress = Math.round(((i + 1) / totalChunks) * 100)
                await eventManager.notify('embedding.processing.progress', { 
                    documentId: this.documentId,
                    progress,
                    chunksProcessed: i + 1,
                    totalChunks
                })
            }

            // Upsert to vector database
            console.log(`💾 Upserting ${vectors.length} vectors to Pinecone...`)
            await this.vectorStorage.upsert(vectors)
            console.log(`✅ Successfully upserted all vectors to Pinecone`)

            await eventManager.notify('embedding.processing.completed', { 
                documentId: this.documentId,
                totalChunks 
            })
            
            console.log(`✨ ProcessEmbeddingCommand completed successfully for: ${this.documentId}`)

        } catch (error) {
            console.error(`ProcessEmbeddingCommand failed for ${this.documentId}:`)
            
            await eventManager.notify('embedding.processing.failed', { 
                documentId: this.documentId,
                error: error instanceof Error ? error.message : 'Unknown error'
            })
            
            // Re-throw to ensure calling code knows about the failure
            throw error
        }
    }

    canExecute(): boolean {
        return !!this.fileContent && this.fileContent.trim().length > 0
    }
}

export class ChatCommand implements ICommand {
    constructor(
        private question: string,
        private aiStrategy: IAIStrategy,
        private vectorStorage: IVectorStorageStrategy
    ) {}

    async *executeStream(): AsyncIterable<string> {
        try {
            await eventManager.notify('chat.message.sent', { 
                question: this.question.substring(0, 100) + '...'
            })

            // Get question embedding
            const questionEmbedding = await this.aiStrategy.generateEmbedding(this.question)
            
            // Find similar chunks
            const similarChunks = await this.vectorStorage.query(questionEmbedding, 5)
            
            let prompt: string
            if (similarChunks.length > 0) {
                const context = similarChunks
                    .map(chunk => chunk.metadata?.content || '')
                    .join('\n\n')
                
                prompt = `Dựa trên thông tin sau:\n\n${context}\n\nHãy trả lời câu hỏi: ${this.question}`
            } else {
                prompt = `Bạn là một AI assistant thông minh. Trả lời câu hỏi: ${this.question}`
            }

            let responseLength = 0
            for await (const chunk of this.aiStrategy.streamResponse(prompt)) {
                responseLength += chunk.length
                yield chunk
            }

            await eventManager.notify('chat.message.received', { 
                responseLength 
            })

        } catch (error) {
            console.error('Chat command error:', error)
            yield `Xin lỗi, đã xảy ra lỗi khi xử lý câu hỏi của bạn: ${error}`
        }
    }

    async execute(): Promise<void> {
        // This is required by ICommand interface but we use executeStream for chat
        throw new Error('Use executeStream() for chat commands')
    }

    canExecute(): boolean {
        return !!this.question && this.question.trim().length > 0
    }
}

// Singleton command manager
export const commandManager = new CommandManager()