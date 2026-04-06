import { IDocumentProcessorFactory, IResponseFactory, IErrorFactory } from "../interfaces/IPatterns"
import { IDocumentProcessor } from "../interfaces/IStrategy"
import { PDFProcessor, DOCXProcessor, TXTProcessor, DefaultProcessor } from "../strategies/document.processors"
import statusCodes from "../constants/statusCodes"

export class DocumentProcessorFactory implements IDocumentProcessorFactory {
    private processors: Map<string, IDocumentProcessor> = new Map()

    constructor() {
        // Initialize processors
        const pdfProcessor = new PDFProcessor()
        const docxProcessor = new DOCXProcessor()  
        const txtProcessor = new TXTProcessor()
        const defaultProcessor = new DefaultProcessor()

        // Register processors
        pdfProcessor.getSupportedTypes().forEach(type => 
            this.processors.set(type, pdfProcessor)
        )
        docxProcessor.getSupportedTypes().forEach(type => 
            this.processors.set(type, docxProcessor)
        )
        txtProcessor.getSupportedTypes().forEach(type => 
            this.processors.set(type, txtProcessor)
        )
        
        // Default processor as fallback
        this.processors.set('*', defaultProcessor)
    }

    createProcessor(fileType: string): IDocumentProcessor {
        const normalizedType = fileType.toLowerCase()
        
        // Try exact match first
        if (this.processors.has(normalizedType)) {
            return this.processors.get(normalizedType)!
        }
        
        // Try to find by checking if any processor can handle this type
        for (const [_, processor] of this.processors) {
            if (processor.canProcess(fileType)) {
                return processor
            }
        }
        
        // Return default processor as fallback
        return this.processors.get('*')!
    }

    getSupportedTypes(): string[] {
        const types = new Set<string>()
        this.processors.forEach((processor, type) => {
            if (type !== '*') {
                types.add(type)
            }
        })
        return Array.from(types)
    }
}

export class ResponseFactory implements IResponseFactory {
    createSuccessResponse(data?: any, message?: string): any {
        return {
            success: true,
            message: message || 'Operation completed successfully',
            data: data || null,
            timestamp: new Date().toISOString()
        }
    }

    createErrorResponse(message: string, statusCode?: number, details?: any): any {
        return {
            success: false,
            message,
            statusCode: statusCode || statusCodes.INTERNAL_SERVER_ERROR,
            details: details || null,
            timestamp: new Date().toISOString()
        }
    }

    createStreamResponse(): any {
        return {
            success: true,
            type: 'stream',
            message: 'Streaming response initiated',
            timestamp: new Date().toISOString()
        }
    }
}

export class ErrorFactory implements IErrorFactory {
    createValidationError(message: string, field?: string): Error {
        const error = new Error(message)
        error.name = 'ValidationError'
        ;(error as any).field = field
        ;(error as any).statusCode = statusCodes.BAD_REQUEST
        return error
    }

    createAuthenticationError(message: string): Error {
        const error = new Error(message)
        error.name = 'AuthenticationError'
        ;(error as any).statusCode = statusCodes.UNAUTHORIZED
        return error
    }

    createNotFoundError(resource: string, id?: string): Error {
        const message = id 
            ? `${resource} with ID '${id}' not found`
            : `${resource} not found`
        const error = new Error(message)
        error.name = 'NotFoundError'
        ;(error as any).resource = resource
        ;(error as any).id = id
        ;(error as any).statusCode = statusCodes.NOT_FOUND
        return error
    }

    createInternalError(message: string, originalError?: Error): Error {
        const error = new Error(message)
        error.name = 'InternalError'
        ;(error as any).originalError = originalError
        ;(error as any).statusCode = statusCodes.INTERNAL_SERVER_ERROR
        return error
    }
}