// Factory Pattern Interfaces
import { IDocumentProcessor } from './IStrategy'

export interface IDocumentProcessorFactory {
    createProcessor(fileType: string): IDocumentProcessor
    getSupportedTypes(): string[]
}

export interface IResponseFactory {
    createSuccessResponse(data?: any, message?: string): any
    createErrorResponse(message: string, statusCode?: number, details?: any): any
    createStreamResponse(): any
}

export interface IErrorFactory {
    createValidationError(message: string, field?: string): Error
    createAuthenticationError(message: string): Error
    createNotFoundError(resource: string, id?: string): Error
    createInternalError(message: string, originalError?: Error): Error
}

// Observer Pattern Interfaces

export interface IEventObserver {
    update(event: string, data: any): Promise<void>
}

export interface IEventSubject {
    subscribe(event: string, observer: IEventObserver): void
    unsubscribe(event: string, observer: IEventObserver): void
    notify(event: string, data: any): Promise<void>
}

// Command Pattern Interfaces

export interface ICommand {
    execute(): Promise<any>
    undo?(): Promise<void>
    canExecute?(): boolean
}

export interface ICommandManager {
    execute(command: ICommand): Promise<any>
    undo(): Promise<void>
    canUndo(): boolean
    getHistory(): ICommand[]
}