import { IEventObserver, IEventSubject } from "../interfaces/IPatterns"

export class EventManager implements IEventSubject {
    private observers: Map<string, Set<IEventObserver>> = new Map()

    subscribe(event: string, observer: IEventObserver): void {
        if (!this.observers.has(event)) {
            this.observers.set(event, new Set())
        }
        this.observers.get(event)!.add(observer)
        console.log(`📝 Observer subscribed to event: ${event}`)
    }

    unsubscribe(event: string, observer: IEventObserver): void {
        const eventObservers = this.observers.get(event)
        if (eventObservers) {
            eventObservers.delete(observer)
        }
    }

    async notify(event: string, data: any): Promise<void> {
        const eventObservers = this.observers.get(event)
        if (!eventObservers || eventObservers.size === 0) {
            return
        }
        
        const promises = Array.from(eventObservers).map(observer => 
            observer.update(event, data).catch(error => 
                console.error(`Observer failed to handle event ${event}:`, error)
            )
        )
        
        await Promise.all(promises)
    }

    getObserverCount(event: string): number {
        return this.observers.get(event)?.size || 0
    }

    getAllEvents(): string[] {
        return Array.from(this.observers.keys())
    }
}

// File Upload Observer
export class FileUploadObserver implements IEventObserver {
    async update(event: string, data: any): Promise<void> {
        switch (event) {
            case 'file.upload.started':
                console.log(`📤 Upload started: ${data.fileName}`)
                break
            case 'file.upload.completed':
                console.log(`✅ Upload completed: ${data.fileName} -> ${data.s3Key}`)
                break
            case 'file.upload.failed':
                console.log(`❌ Upload failed: ${data.fileName} - ${data.error}`)
                break
            default:
                console.log(`📁 File event: ${event}`, data)
        }
    }
}

// Embedding Processing Observer  
export class EmbeddingObserver implements IEventObserver {
    async update(event: string, data: any): Promise<void> {
        switch (event) {
            case 'embedding.processing.started':
                console.log(`🔄 Embedding processing started: ${data.documentId}`)
                break
            case 'embedding.processing.progress':
                console.log(`⏳ Embedding progress: ${data.progress}% (${data.chunksProcessed}/${data.totalChunks})`)
                break
            case 'embedding.processing.completed':
                console.log(`✅ Embedding completed: ${data.documentId} (${data.totalChunks} chunks)`)
                break
            case 'embedding.processing.failed':
                console.log(`❌ Embedding failed: ${data.documentId} - ${data.error}`)
                break
            default:
                console.log(`🔮 Embedding event: ${event}`, data)
        }
    }
}

// Chat Observer
export class ChatObserver implements IEventObserver {
    async update(event: string, data: any): Promise<void> {
        switch (event) {
            case 'chat.message.sent':
                console.log(`💬 Message sent by user: ${data.userId}`)
                break
            case 'chat.message.received':
                console.log(`🤖 AI response generated (${data.responseLength} characters)`)
                break
            case 'chat.session.created':
                console.log(`📝 New chat session: ${data.sessionId}`)
                break
            case 'chat.session.deleted':
                console.log(`🗑️ Chat session deleted: ${data.sessionId}`)
                break
            default:
                console.log(`💬 Chat event: ${event}`, data)
        }
    }
}

// Create singleton event manager
export const eventManager = new EventManager()

// Initialize observers
export const initializeObservers = () => {
    const fileUploadObserver = new FileUploadObserver()
    const embeddingObserver = new EmbeddingObserver()
    const chatObserver = new ChatObserver()

    // Subscribe to events
    eventManager.subscribe('file.upload.started', fileUploadObserver)
    eventManager.subscribe('file.upload.completed', fileUploadObserver)
    eventManager.subscribe('file.upload.failed', fileUploadObserver)

    eventManager.subscribe('embedding.processing.started', embeddingObserver)
    eventManager.subscribe('embedding.processing.progress', embeddingObserver)
    eventManager.subscribe('embedding.processing.completed', embeddingObserver)
    eventManager.subscribe('embedding.processing.failed', embeddingObserver)

    eventManager.subscribe('chat.message.sent', chatObserver)
    eventManager.subscribe('chat.message.received', chatObserver)
    eventManager.subscribe('chat.session.created', chatObserver)
    eventManager.subscribe('chat.session.deleted', chatObserver)

    console.log('📡 Event observers initialized')
}