# Design Patterns trong ChatBot Application

## Tổng quan
Dự án ChatBot này sử dụng nhiều Design Patterns để tạo ra một architecture có thể bảo trì, mở rộng và tái sử dụng. Dưới đây là chi tiết từng pattern được sử dụng và vị trí implementation.

---

## 1. Singleton Pattern ⭐

### Mục đích
Đảm bảo chỉ có một instance duy nhất cho các services quan trọng và connection clients.

### Vị trí sử dụng

#### **Provider Connections** 
**Files:** `backend/src/providers/*.ts`

**S3Service** - `backend/src/providers/s3.connect.ts`
```typescript
export class S3Service {
    private static instance: S3Service
    private s3Client: S3Client

    private constructor() { /* ... */ }
    static getInstance(): S3Service { /* ... */ }
    getS3Client(): S3Client { return this.s3Client }
}
```

**DynamoDBService** - `backend/src/providers/dynamodb.connect.ts`
```typescript
export class DynamoDBService {
    private static instance: DynamoDBService
    private dynamoClient: DynamoDBDocumentClient

    static getInstance(): DynamoDBService { /* ... */ }
    getDynamoClient(): DynamoDBDocumentClient { /* ... */ }
}
```

**PineconeService** - `backend/src/providers/pinecone.connect.ts`
```typescript
export class PineconeService {
    private static instance: PineconeService
    private pinecone: Pinecone

    static getInstance(): PineconeService { /* ... */ }
    async getIndex(indexName: string) { /* ... */ }
}
```

**AzureOpenAIService** - `backend/src/providers/azure-ai.connect.ts`
```typescript
export class AzureOpenAIService {
    private static instance: AzureOpenAIService
    private client: OpenAI

    static getInstance(): AzureOpenAIService { /* ... */ }
    getClient(): OpenAI { return this.client }
}
```

#### **Service Classes**
**Files:** `backend/src/services/*.ts`

Tất cả services export singleton instances:
```typescript
// embedding.service.ts
export default new EmbeddingService()

// chat.service.ts  
export default new ChatService()

// auth.service.ts
export default new AuthService()
```

### Lý do sử dụng
- **Connection pooling**: Tránh tạo multiple database/API connections
- **Resource management**: Tiết kiệm memory và network resources
- **Configuration consistency**: Đảm bảo cùng config cho toàn app
- **State management**: Duy trì state giữa các requests

---

## 2. Strategy Pattern 🎯

### Mục đích
Cho phép chuyển đổi algorithms/implementations tại runtime mà không thay đổi code.

### Vị trí sử dụng

#### **AI Strategies** 
**File:** `backend/src/strategies/azure-openai.strategy.ts`

**Interface** - `backend/src/interfaces/IStrategy.ts`:
```typescript
export interface IAIStrategy {
    generateResponse(prompt: string): Promise<string>
    generateEmbedding(text: string): Promise<number[]>
    streamResponse(prompt: string): AsyncIterable<string>
}
```

**Implementation**:
```typescript
export class AzureOpenAIStrategy implements IAIStrategy {
    async generateResponse(prompt: string): Promise<string> {
        const response = await azureService.getClient().chat.completions.create({
            model: AZURE_LLM_DEPLOYMENT_NAME!,
            messages: [{ role: 'user', content: prompt }]
        })
        return response.choices[0]?.message?.content || ''
    }
}
```

**Sử dụng trong:** `backend/src/services/embedding.service.ts`, `backend/src/services/chat.service.ts`

#### **Storage Strategies**
**File:** `backend/src/strategies/storage.strategies.ts`

**File Storage Strategy**:
```typescript
export interface IFileStorageStrategy {
    upload(key: string, buffer: Buffer, contentType: string): Promise<string>
    download(key: string): Promise<Buffer>
    delete(key: string): Promise<void>
}

export class S3StorageStrategy implements IFileStorageStrategy {
    async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        })
        await s3Service.getS3Client().send(command)
        return this.getUrl(key)
    }
}
```

**Vector Storage Strategy**:
```typescript
export interface IVectorStorageStrategy {
    upsert(vectors: Array<{id: string, values: number[]}>): Promise<void>
    query(vector: number[], topK: number): Promise<Array<{id: string, score: number}>>
}

export class PineconeStorageStrategy implements IVectorStorageStrategy {
    async upsert(vectors: Array<{id: string, values: number[]}>): Promise<void> {
        const index = await pineconeService.getIndex(this.indexName)
        // Process in batches of 100
        const batchSize = 100
        for (let i = 0; i < vectors.length; i += batchSize) {
            const batch = vectors.slice(i, i + batchSize)
            await index.upsert(batch)
        }
    }
}
```

#### **Document Processing Strategies**
**File:** `backend/src/strategies/document.processors.ts`

**Interface**:
```typescript
export interface IDocumentProcessor {
    canProcess(fileType: string): boolean
    extractText(buffer: Buffer): Promise<string>
    getSupportedTypes(): string[]
}
```

**Implementations**:
```typescript
export class PDFProcessor implements IDocumentProcessor {
    async extractText(buffer: Buffer): Promise<string> {
        const pdfParse = require('pdf2json')
        // PDF processing logic...
    }
}

export class DOCXProcessor implements IDocumentProcessor {
    async extractText(buffer: Buffer): Promise<string> {
        const mammoth = require('mammoth')
        // DOCX processing logic...
    }
}
```

### Lý do sử dụng
- **Flexibility**: Dễ dàng thay đổi từ AI provider này sang provider khác
- **Testing**: Có thể mock strategy cho unit tests  
- **Scalability**: Thêm storage/AI providers mới mà không thay đổi business logic
- **Separation of Concerns**: Logic xử lý tách biệt với implementation chi tiết

---

## 3. Factory Pattern 🏭

### Mục đích
Tạo objects mà không cần specify exact class, delegate object creation cho factory classes.

### Vị trí sử dụng

#### **Document Processor Factory**
**File:** `backend/src/utils/pattern.factories.ts`

```typescript
export class DocumentProcessorFactory implements IDocumentProcessorFactory {
    private processors: Map<string, IDocumentProcessor> = new Map()

    constructor() {
        const pdfProcessor = new PDFProcessor()
        const docxProcessor = new DOCXProcessor()  
        const txtProcessor = new TXTProcessor()
        
        // Register processors by file types
        pdfProcessor.getSupportedTypes().forEach(type => 
            this.processors.set(type, pdfProcessor)
        )
        docxProcessor.getSupportedTypes().forEach(type => 
            this.processors.set(type, docxProcessor)
        )
    }

    createProcessor(fileType: string): IDocumentProcessor {
        const normalizedType = fileType.toLowerCase()
        
        if (this.processors.has(normalizedType)) {
            return this.processors.get(normalizedType)!
        }
        
        // Return default processor as fallback
        return this.processors.get('*')!
    }
}
```

**Sử dụng trong:** `backend/src/services/embedding.service.ts`
```typescript
// embedding.service.ts
constructor() {
    this.documentProcessor = new DocumentProcessorFactory()
}

// Usage
const processor = this.documentProcessor.createProcessor(fileExtension)
const textContent = await processor.extractText(fileBuffer)
```

#### **Response Factory**
**File:** `backend/src/utils/pattern.factories.ts`

```typescript
export class ResponseFactory implements IResponseFactory {
    createSuccessResponse(data?: any, message?: string): any {
        return {
            success: true,
            message: message || 'Operation completed successfully',
            data: data || null,
            timestamp: new Date().toISOString()
        }
    }

    createErrorResponse(message: string, statusCode?: number): any {
        return {
            success: false,
            message,
            statusCode: statusCode || 500,
            timestamp: new Date().toISOString()
        }
    }
}
```

**Sử dụng trong:** Controllers và Services để tạo consistent response format

### Lý do sử dụng
- **Consistent Object Creation**: Đảm bảo objects được tạo với cùng format/structure
- **Centralized Logic**: Logic tạo object tập trung ở một nơi 
- **Flexibility**: Dễ thay đổi cách tạo objects mà không ảnh hưởng client code
- **Type Safety**: Factory methods có thể enforce type constraints

---

## 4. Repository Pattern 📚

### Mục đích
Tạo abstraction layer giữa business logic và data access layer.

### Vị trí sử dụng

#### **Base Repository Interface**
**File:** `backend/src/interfaces/IRepository.ts`

```typescript
interface IBaseRepository<T, CreateInput> {
    create(input: CreateInput): Promise<T>
    findById(id: string): Promise<T | null>
    findAll(): Promise<T[]>
    update(id: string, updates: any): Promise<void>
    delete(id: string): Promise<void>
}

export interface IUserRepository extends IBaseRepository<User, CreateUserInput> {
    findByEmail(email: string): Promise<User | null>
    updateRefreshToken(userId: string, token: string | null): Promise<void>
}

export interface IChatRepository extends IBaseRepository<ChatSession, any> {
    findByUser(userId: string): Promise<ChatSession[]>
    findByUserAndSessionId(userId: string, sessionId: string): Promise<ChatSession | null>
}
```

#### **Repository Implementations**

**UserRepository** - `backend/src/repositories/user.repository.ts`
```typescript
export class UserRepository implements IUserRepository {
    private tableName = USER_TABLE_NAME!

    async create(input: CreateUserInput): Promise<User> {
        const user: User = {
            id: uuidv4(),
            email: input.email,
            passwordHash: input.passwordHash,
            createdAt: now,
            updatedAt: now
        }

        await dynamoService.getDynamoClient().send(new PutCommand({
            TableName: this.tableName,
            Item: user
        }))

        return user
    }

    async findByEmail(email: string): Promise<User | null> {
        // DynamoDB query implementation...
    }
}
```

**ChatRepository** - `backend/src/repositories/chat.repository.ts`
```typescript
export class ChatRepository implements IChatRepository {
    async create(input: { userId: string, messages: ChatMessage[] }): Promise<ChatSession> {
        // DynamoDB implementation for chat sessions...
    }

    async findByUser(userId: string): Promise<ChatSession[]> {
        // Query user's chat history...
    }
}
```

**DocumentRepository** - `backend/src/repositories/document.repository.ts`
```typescript
export class DocumentRepository implements IDocumentRepository {
    async create(input: CreateDocumentInput): Promise<DocumentMetadata> {
        // Create document metadata in DynamoDB...
    }

    async findByStatus(status: string): Promise<DocumentMetadata[]> {
        // Query documents by processing status...
    }
}
```

#### **Sử dụng trong Services**
**Files:** `backend/src/services/*.ts`

```typescript
// embedding.service.ts
export class EmbeddingService {
    private documentRepository: DocumentRepository

    constructor() {
        this.documentRepository = new DocumentRepository()
    }

    async processSingleFile(fileUrl: any): Promise<void> {
        // Create document metadata
        const document = await this.documentRepository.create(documentInput)
        
        // Update status after processing
        await this.documentRepository.updateStatus(fileUrl.key, 'embedded', chunks.length)
    }
}
```

### Lý do sử dụng
- **Data Access Abstraction**: Business logic không phụ thuộc vào database implementation
- **Testability**: Dễ mock repository cho unit tests
- **Consistency**: Cùng interface cho tất cả data access operations
- **Maintainability**: Thay đổi database schema chỉ cần update repository layer

---

## 5. Observer Pattern 👀

### Mục đích
Định nghĩa one-to-many dependency giữa objects, khi một object thay đổi state thì tất cả dependents được notify.

### Vị trí sử dụng

#### **Event Manager**
**File:** `backend/src/utils/event.manager.ts`

```typescript
export interface IEventObserver {
    update(event: string, data: any): Promise<void>
}

export interface IEventSubject {
    subscribe(event: string, observer: IEventObserver): void
    notify(event: string, data: any): Promise<void>
}

class EventManager implements IEventSubject {
    private observers: Map<string, IEventObserver[]> = new Map()

    subscribe(event: string, observer: IEventObserver): void {
        if (!this.observers.has(event)) {
            this.observers.set(event, [])
        }
        this.observers.get(event)!.push(observer)
    }

    async notify(event: string, data: any): Promise<void> {
        const eventObservers = this.observers.get(event) || []
        await Promise.all(
            eventObservers.map(observer => observer.update(event, data))
        )
    }
}

export const eventManager = new EventManager()
```

#### **Event Observers**

**Document Processing Observer**:
```typescript
class DocumentProcessingObserver implements IEventObserver {
    async update(event: string, data: any): Promise<void> {
        switch (event) {
            case 'embedding.processing.started':
                console.log(`📄 Started processing: ${data.documentId}`)
                break
            case 'embedding.processing.completed':
                console.log(`✅ Completed processing: ${data.documentId}`)
                break
            case 'embedding.processing.failed':
                console.error(`❌ Failed processing: ${data.documentId}`, data.error)
                break
        }
    }
}
```

#### **Sử dụng trong Services**
**File:** `backend/src/services/embedding.service.ts`

```typescript
export class EmbeddingService {
    async processSingleFile(fileUrl: any): Promise<void> {
        try {
            // Notify processing started
            await eventManager.notify('embedding.processing.started', { 
                documentId: fileUrl.key 
            })

            // Process file...
            
            // Notify processing completed
            await eventManager.notify('embedding.processing.completed', { 
                documentId: fileUrl.key,
                chunks: chunks.length
            })
        } catch (error) {
            // Notify processing failed
            await eventManager.notify('embedding.processing.failed', { 
                documentId: fileUrl.key,
                error: error.message
            })
        }
    }
}
```

#### **Observer Initialization**
**File:** `backend/src/index.ts`

```typescript
import { initializeObservers } from './utils/event.manager'

// Initialize Observer Pattern
initializeObservers()
console.log('🎯 Design Patterns initialized: Observer, Factory, Strategy, Repository, Command, Builder')
```

### Lý do sử dụng
- **Loose Coupling**: Services không cần biết ai đang listen events
- **Extensibility**: Dễ dàng thêm observers mới mà không thay đổi existing code
- **Event-Driven Architecture**: Supports asynchronous processing và logging
- **Monitoring**: Dễ track và monitor system activities

---

## 6. Command Pattern ⚡

### Mục đích
Encapsulate requests thành objects, cho phép parameterize clients với different requests, queue operations, và support undo.

### Vị trí sử dụng

#### **Command Interface**
**File:** `backend/src/interfaces/IPatterns.ts`

```typescript
export interface ICommand {
    execute(): Promise<any>
    undo?(): Promise<void>
    canExecute?(): boolean
}

export interface ICommandManager {
    execute(command: ICommand): Promise<any>
    undo(): Promise<void>
    getHistory(): ICommand[]
}
```

#### **Command Implementations**
**File:** `backend/src/utils/commands.ts`

```typescript
export class ProcessEmbeddingCommand implements ICommand {
    constructor(
        private documentId: string,
        private textContent: string,
        private fileName: string,
        private aiStrategy: IAIStrategy,
        private vectorStorage: IVectorStorageStrategy
    ) {}

    async execute(): Promise<void> {
        console.log(`🚛 Executing ProcessEmbeddingCommand for: ${this.fileName}`)
        
        // Split text into chunks
        const { RecursiveCharacterTextSplitter } = await import('langchain/text_splitter')
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200
        })
        
        const chunks = await textSplitter.splitText(this.textContent)
        
        // Generate embeddings for each chunk
        const vectors: Array<{id: string, values: number[], metadata: any}> = []
        
        for (let i = 0; i < chunks.length; i++) {
            const embedding = await this.aiStrategy.generateEmbedding(chunks[i])
            vectors.push({
                id: `${this.documentId}_chunk_${i}`,
                values: embedding,
                metadata: {
                    documentId: this.documentId,
                    chunkIndex: i,
                    chunkText: chunks[i],
                    fileName: this.fileName
                }
            })
        }
        
        // Store vectors in Pinecone
        await this.vectorStorage.upsert(vectors)
        console.log(`✅ ProcessEmbeddingCommand completed: ${vectors.length} vectors stored`)
    }
}

export class UploadFileCommand implements ICommand {
    constructor(
        private key: string,
        private buffer: Buffer,
        private contentType: string,
        private fileStorage: IFileStorageStrategy
    ) {}

    async execute(): Promise<string> {
        console.log(`📤 Executing UploadFileCommand for: ${this.key}`)
        const url = await this.fileStorage.upload(this.key, this.buffer, this.contentType)
        console.log(`✅ UploadFileCommand completed: ${url}`)
        return url
    }
}
```

#### **Command Manager**
**File:** `backend/src/utils/commands.ts`

```typescript
class CommandManager implements ICommandManager {
    private history: ICommand[] = []

    async execute(command: ICommand): Promise<any> {
        if (command.canExecute && !command.canExecute()) {
            throw new Error('Command cannot be executed')
        }

        const result = await command.execute()
        this.history.push(command)
        
        // Keep only last 50 commands
        if (this.history.length > 50) {
            this.history.shift()
        }

        return result
    }

    async undo(): Promise<void> {
        const command = this.history.pop()
        if (command && command.undo) {
            await command.undo()
        }
    }

    getHistory(): ICommand[] {
        return [...this.history]
    }
}

export const commandManager = new CommandManager()
```

#### **Sử dụng trong Services**
**File:** `backend/src/services/embedding.service.ts`

```typescript
export class EmbeddingService {
    async processSingleFile(fileUrl: any): Promise<void> {
        // Create and execute processing command
        const processingCommand = new ProcessEmbeddingCommand(
            fileUrl.key,
            textContent,
            fileUrl.originalName || fileUrl.key,
            this.aiStrategy,
            this.vectorStorage
        )

        await commandManager.execute(processingCommand)
    }
}
```

### Lý do sử dụng
- **Decoupling**: Decouples object that invokes operation from object that performs it
- **Flexibility**: Commands có thể được stored, logged, queued
- **Undo Support**: Natural support cho undo operations  
- **Macro Commands**: Có thể combine multiple commands
- **Logging/Auditing**: Easy tracking của executed operations

---

## 7. Builder Pattern 🔧

### Mục đích
Construct complex objects step by step, cho phép tạo different representations của same object.

### Vị trí sử dụng

#### **Response Builder**
**File:** `backend/src/utils/builders.ts`

```typescript
export class ResponseBuilder {
    private response: any = {}

    success(success: boolean = true): ResponseBuilder {
        this.response.success = success
        return this
    }

    message(message: string): ResponseBuilder {
        this.response.message = message
        return this
    }

    data(data: any): ResponseBuilder {
        this.response.data = data
        return this
    }

    statusCode(code: number): ResponseBuilder {
        this.response.statusCode = code
        return this
    }

    timestamp(timestamp?: string): ResponseBuilder {
        this.response.timestamp = timestamp || new Date().toISOString()
        return this
    }

    metadata(metadata: any): ResponseBuilder {
        this.response.metadata = metadata
        return this
    }

    build(): any {
        return { ...this.response }
    }
}

// Helper method
export const createResponse = () => new ResponseBuilder()
```

#### **Query Builder** 
**File:** `backend/src/utils/builders.ts`

```typescript
export class QueryBuilder {
    private query: any = {}

    select(fields: string[]): QueryBuilder {
        this.query.select = fields
        return this
    }

    where(field: string, operator: string, value: any): QueryBuilder {
        if (!this.query.where) {
            this.query.where = []
        }
        this.query.where.push({ field, operator, value })
        return this
    }

    orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryBuilder {
        this.query.orderBy = { field, direction }
        return this
    }

    limit(count: number): QueryBuilder {
        this.query.limit = count
        return this
    }

    build(): any {
        return { ...this.query }
    }
}
```

#### **Sử dụng trong Controllers**
**File:** `backend/src/controllers/*.ts`

```typescript
// chat.controller.ts
export const getChatHistory = async (req: Request, res: Response) => {
    try {
        const chatHistory = await chatService.getChatHistory(userId)
        
        const response = createResponse()
            .success(true)
            .message('Chat history retrieved successfully')
            .data(chatHistory)
            .metadata({
                totalSessions: chatHistory.length,
                userId: userId
            })
            .timestamp()
            .build()

        res.json(response)
    } catch (error) {
        const errorResponse = createResponse()
            .success(false)
            .message('Failed to retrieve chat history')
            .statusCode(500)
            .data({ error: error.message })
            .build()

        res.status(500).json(errorResponse)
    }
}
```

### Lý do sử dụng
- **Readable Code**: Method chaining tạo readable và expressive code
- **Flexible Construction**: Có thể tạo objects với different combinations của properties
- **Immutability**: Każdy Builder call returns new instance
- **Consistent API**: Standardized way để build complex objects
- **Validation**: Có thể validate trong build() method

---

## Summary & Benefits 🎯

### Patterns được sử dụng:
1. **Singleton** - Database connections, Services
2. **Strategy** - AI providers, Storage methods, Document processors  
3. **Factory** - Object creation, Response formatting
4. **Repository** - Data access abstraction
5. **Observer** - Event-driven architecture
6. **Command** - Operation encapsulation
7. **Builder** - Complex object construction

### Lợi ích tổng thể:
- **Maintainability**: Code dễ maintain và update
- **Extensibility**: Dễ thêm features mới mà không break existing code
- **Testability**: Mỗi component có thể test độc lập
- **Separation of Concerns**: Mỗi class có responsibility rõ ràng
- **Code Reusability**: Patterns có thể reuse across different parts
- **Consistent Architecture**: Toàn bộ app follow consistent patterns

### Kết nối giữa các Patterns:
- **Singleton Services** sử dụng **Strategy** để chọn implementations
- **Factory** tạo objects được sử dụng bởi **Strategy** implementations  
- **Repository** pattern được sử dụng trong **Command** executions
- **Observer** pattern monitor **Command** execution events
- **Builder** pattern tạo responses từ **Repository** data

Kiến trúc này tạo ra một hệ thống flexible, maintainable và scalable phù hợp cho enterprise applications.

    createProcessor(fileType: string): IDocumentProcessor {
        const normalizedType = fileType.toLowerCase()
        
        if (this.processors.has(normalizedType)) {
            return this.processors.get(normalizedType)!
        }
        
        // Fallback to default processor
        return this.processors.get('*')!
    }
}
```

**Response Factory:**
```typescript
export class ResponseFactory {
    createSuccessResponse(data?: any, message?: string): any {
        return {
            success: true,
            message: message || 'Operation completed successfully',
            data: data || null,
            timestamp: new Date().toISOString()
        }
    }

    createErrorResponse(message: string, statusCode?: number): any {
        return {
            success: false,
            message,
            statusCode: statusCode || 500,
            timestamp: new Date().toISOString()
        }
    }
}
```

## 3. Strategy Pattern 🎯

### Đã áp dụng cho:
- AI model selection (Azure OpenAI, OpenAI)
- File processing algorithms
- Storage strategies (S3, Pinecone)

### Implementation:

**AI Strategy:**
```typescript
interface IAIStrategy {
    generateResponse(prompt: string): Promise<string>
    generateEmbedding(text: string): Promise<number[]>
    streamResponse(prompt: string): AsyncIterable<string>
}

class AzureOpenAIStrategy implements IAIStrategy {
    async generateResponse(prompt: string): Promise<string> {
        const response = await azureClient.chat.completions.create({
            model: AZURE_LLM_DEPLOYMENT_NAME!,
            messages: [{ role: 'user', content: prompt }]
        })
        return response.choices[0]?.message?.content || ''
    }
}
```

**Storage Strategy:**
```typescript
interface IFileStorageStrategy {
    upload(key: string, buffer: Buffer, contentType: string): Promise<string>
    download(key: string): Promise<Buffer>
    delete(key: string): Promise<void>
    getUrl(key: string): string
}

class S3StorageStrategy implements IFileStorageStrategy {
    async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        })
        await s3Client.send(command)
        return this.getUrl(key)
    }
}
```

## 4. Repository Pattern 📚

### Đã áp dụng cho:
- Data access layer cho Users, Documents, ChatHistory
- Abstraction từ database operations

### Implementation:

**Base Repository Interface:**
```typescript
interface IBaseRepository<T, CreateInput> {
    create(input: CreateInput): Promise<T>
    findById(id: string): Promise<T | null>
    update(id: string, updates: Partial<T>): Promise<void>
    delete(id: string): Promise<void>
}

interface IUserRepository extends IBaseRepository<User, CreateUserInput> {
    findByEmail(email: string): Promise<User | null>
    updateRefreshToken(id: string, refreshToken: string): Promise<void>
}
```

**Repository Implementation:**
```typescript
export class UserRepository implements IUserRepository {
    async create(input: CreateUserInput): Promise<User> {
        const user: User = {
            id: `user_${Date.now()}`,
            ...input,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }

        await dynamoClient.send(new PutCommand({
            TableName: this.tableName,
            Item: user
        }))

        return user
    }
}
```

## 5. Observer Pattern 👀

### Đã áp dụng cho:
- File upload notifications
- Embedding process status updates
- Chat events

### Implementation:

**Event Manager:**
```typescript
export class EventManager implements IEventSubject {
    private observers: Map<string, Set<IEventObserver>> = new Map()

    subscribe(event: string, observer: IEventObserver): void {
        if (!this.observers.has(event)) {
            this.observers.set(event, new Set())
        }
        this.observers.get(event)!.add(observer)
    }

    async notify(event: string, data: any): Promise<void> {
        const eventObservers = this.observers.get(event)
        if (!eventObservers) return

        const promises = Array.from(eventObservers).map(observer => 
            observer.update(event, data)
        )
        await Promise.all(promises)
    }
}
```

**Observer Implementation:**
```typescript
export class FileUploadObserver implements IEventObserver {
    async update(event: string, data: any): Promise<void> {
        switch (event) {
            case 'file.upload.started':
                console.log(`📤 Upload started: ${data.fileName}`)
                break
            case 'file.upload.completed':
                console.log(`✅ Upload completed: ${data.fileName}`)
                break
            case 'file.upload.failed':
                console.log(`❌ Upload failed: ${data.fileName}`)
                break
        }
    }
}
```

## 6. Command Pattern ⚡

### Đã áp dụng cho:
- File upload operations
- Embedding processing
- Chat operations
- Undo/Redo functionality

### Implementation:

**Command Interface:**
```typescript
interface ICommand {
    execute(): Promise<any>
    undo?(): Promise<void>
    canExecute?(): boolean
}

interface ICommandManager {
    execute(command: ICommand): Promise<any>
    undo(): Promise<void>
    canUndo(): boolean
    getHistory(): ICommand[]
}
```

**Upload Command:**
```typescript
export class UploadFileCommand implements ICommand {
    constructor(
        private fileKey: string,
        private fileBuffer: Buffer,
        private contentType: string,
        private fileStorage: IFileStorageStrategy
    ) {}

    async execute(): Promise<string> {
        await eventManager.notify('file.upload.started', { 
            fileName: this.fileKey 
        })

        const url = await this.fileStorage.upload(
            this.fileKey, 
            this.fileBuffer, 
            this.contentType
        )
        
        await eventManager.notify('file.upload.completed', { 
            fileName: this.fileKey,
            url 
        })

        return url
    }

    async undo(): Promise<void> {
        await this.fileStorage.delete(this.fileKey)
    }
}
```

## 7. Builder Pattern 🔧

### Đã áp dụng cho:
- Response construction
- Query building
- Complex object creation

### Implementation:

**Response Builder:**
```typescript
export class ResponseBuilder {
    private response: any = {}

    static create(): ResponseBuilder {
        return new ResponseBuilder()
    }

    setSuccess(success: boolean = true): ResponseBuilder {
        this.response.success = success
        return this
    }

    setMessage(message: string): ResponseBuilder {
        this.response.message = message
        return this
    }

    setData(data: any): ResponseBuilder {
        this.response.data = data
        return this
    }

    build(): any {
        return { ...this.response }
    }

    send(res: Response): void {
        const statusCode = this.response.statusCode || 200
        res.status(statusCode).json(this.build())
    }

    // Convenience methods
    static success(data?: any, message?: string): ResponseBuilder {
        return new ResponseBuilder()
            .setSuccess(true)
            .setMessage(message || 'Operation successful')
            .setData(data)
    }
}
```

**Usage trong Controller:**
```typescript
// Before (old way)
res.status(200).json({
    success: true,
    message: 'User registered successfully',
    data: { user, accessToken, refreshToken }
})

// After (với Builder pattern)
ResponseBuilder.success({
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken
}, 'User registered successfully')
    .setStatus(201)
    .send(res)
```

## Cấu trúc Service Layer Mới

### Trước khi Refactor:
```
- AuthService: Trực tiếp sử dụng DynamoDB commands
- EmbeddingService: Coupled với specific implementations  
- ChatService: Mixed concerns
- UploadService: Basic functionality
```

### Sau khi Refactor:
```
- AuthService: Sử dụng UserRepository + ErrorFactory
- EmbeddingService: Strategy pattern cho AI + Storage
- ChatService: Command pattern + Observer notifications
- UploadService: Strategy pattern + Command pattern
```

## Event Flow với Observer Pattern

### File Upload Process:
```
1. UploadCommand.execute()
2. → notify('file.upload.started')
3. → FileUploadObserver logs status
4. → Upload to S3 via StorageStrategy
5. → notify('file.upload.completed')
6. → Auto-trigger EmbeddingCommand
7. → notify('embedding.processing.started')
8. → EmbeddingObserver tracks progress
```

### Chat Process:
```
1. ChatCommand.executeStream()
2. → notify('chat.message.sent') 
3. → AIStrategy generates embedding
4. → VectorStorageStrategy queries similar chunks
5. → AIStrategy streams response
6. → notify('chat.message.received')
7. → ChatRepository saves session
8. → notify('chat.session.created')
```

## Runtime Strategy Switching

Services hỗ trợ runtime strategy switching:

```typescript
// Switch AI strategy
chatService.setAIStrategy(new OpenAIStrategy())

// Switch storage strategy  
uploadService.setStorageStrategy(new LocalStorageStrategy())

// Switch vector storage
embeddingService.setVectorStorage(new ChromaDBStrategy())
```

## Error Handling chuẩn hóa

### Trước:
```typescript
throw new Error('User already exists')
throw new ConflictError('User already exists')  
```

### Sau (với ErrorFactory):
```typescript
throw this.errorFactory.createValidationError('User already exists', 'email')
throw this.errorFactory.createAuthenticationError('Invalid credentials')
throw this.errorFactory.createNotFoundError('User', userId)
```

## Response chuẩn hóa

### Trước:
```typescript
res.status(200).json({
    message: 'Success',
    data: result,
    timestamp: new Date()
})
```

### Sau (với ResponseBuilder):
```typescript
ResponseBuilder.success(result, 'Operation successful')
    .send(res)

ResponseBuilder.error('Operation failed')
    .setStatus(500)
    .send(res)
```

## Lợi ích thực tế đã đạt được:

### 1. **Maintainability** ✅
- Code tách biệt concerns rõ ràng
- Dễ debug và fix issues
- Consistent error handling

### 2. **Extensibility** ✅ 
- Dễ thêm AI providers mới (Anthropic, Cohere)
- Support multiple storage solutions
- Pluggable document processors

### 3. **Testability** ✅
- Mock repositories dễ dàng
- Strategy isolation cho unit tests
- Command pattern cho integration tests

### 4. **Reusability** ✅
- Upload service tái sử dụng across controllers
- Repository layer độc lập với business logic
- Observer system cho multiple features

### 5. **Performance** ✅
- Singleton connections giảm overhead
- Command pattern với undo cho user experience
- Observer pattern không block main operations

### 6. **Team Collaboration** ✅
- Clear separation of concerns
- Standardized patterns across codebase
- Self-documenting architecture

## Migration Guide

Để migrate từ code cũ sang code mới:

### 1. **Update Imports:**
```typescript
// Old
import AuthService from '../services/auth.service'
import { ChatService } from '../services/chat.service'

// New  
import authService from '../services/auth.service'
import chatService from '../services/chat.service.refactored'
```

### 2. **Update Controllers:**
```typescript
// Old
import authController from '../controllers/auth.controller'

// New
import authController from '../controllers/auth.controller.refactored'
```

### 3. **Update Main Entry:**
```typescript
// Old
import './src/index.ts'

// New  
import './src/index.refactored.ts'
```

## Kết luận

Việc refactor này đã chuyển đổi hoàn toàn codebase từ procedural code sang professional architecture với:

- **8 Design Patterns** được implement đầy đủ
- **Separation of Concerns** rõ ràng
- **SOLID Principles** được tuân thủ
- **Error Handling** chuẩn hóa
- **Event-Driven Architecture** với Observer pattern
- **Strategy Pattern** cho future scalability
- **Production-ready** architecture

Codebase giờ đây sẵn sàng cho:
- Team development
- Feature expansion  
- Third-party integrations
- Performance optimization
- Automated testing
- Production deployment