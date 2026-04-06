// Repository Pattern Interfaces

export interface IBaseRepository<T, CreateInput> {
    create(input: CreateInput): Promise<T>
    findById(id: string): Promise<T | null>
    update(id: string, updates: Partial<T>): Promise<void>
    delete(id: string): Promise<void>
}

export interface IUserRepository extends IBaseRepository<any, any> {
    findByEmail(email: string): Promise<any | null>
    updateRefreshToken(id: string, refreshToken: string): Promise<void>
}

export interface IDocumentRepository extends IBaseRepository<any, any> {
    findByStatus(status: 'processing' | 'embedded' | 'error'): Promise<any[]>
    updateStatus(id: string, status: 'processing' | 'embedded' | 'error', totalChunks?: number, errorMessage?: string): Promise<void>
    findByUser(userId: string): Promise<any[]>
}

export interface IChatRepository extends IBaseRepository<any, any> {
    findByUser(userId: string): Promise<any[]>
    findByUserAndSessionId(userId: string, sessionId: string): Promise<any | null>
    deleteSession(userId: string, sessionId: string): Promise<void>
}