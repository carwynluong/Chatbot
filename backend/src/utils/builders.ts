import { Response } from 'express'
import statusCodes from '../constants/statusCodes'

export class ResponseBuilder {
    private response: any = {}

    static create(): ResponseBuilder {
        return new ResponseBuilder()
    }

    setSuccess(success: boolean = true): ResponseBuilder {
        this.response.success = success
        return this
    }

    setStatus(status: number): ResponseBuilder {
        this.response.statusCode = status
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

    setError(error: string | Error): ResponseBuilder {
        this.response.success = false
        this.response.error = error instanceof Error ? error.message : error
        return this
    }

    setTimestamp(timestamp: Date = new Date()): ResponseBuilder {
        this.response.timestamp = timestamp.toISOString()
        return this
    }

    setPagination(page: number, limit: number, total: number): ResponseBuilder {
        this.response.pagination = {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
        return this
    }

    setMeta(meta: any): ResponseBuilder {
        this.response.meta = meta
        return this
    }

    build(): any {
        return { ...this.response }
    }

    send(res: Response): void {
        const statusCode = this.response.statusCode || 
            (this.response.success === false ? statusCodes.INTERNAL_SERVER_ERROR : statusCodes.OK)
        
        res.status(statusCode).json(this.build())
    }

    // Convenience methods for common responses
    static success(data?: any, message?: string): ResponseBuilder {
        return new ResponseBuilder()
            .setSuccess(true)
            .setStatus(statusCodes.OK)
            .setMessage(message || 'Operation successful')
            .setData(data)
            .setTimestamp()
    }

    static error(message: string, statusCode: number = statusCodes.INTERNAL_SERVER_ERROR, data?: any): ResponseBuilder {
        return new ResponseBuilder()
            .setSuccess(false)
            .setStatus(statusCode)
            .setMessage(message)
            .setData(data)
            .setTimestamp()
    }

    static notFound(resource: string, id?: string): ResponseBuilder {
        const message = id 
            ? `${resource} with ID '${id}' not found`
            : `${resource} not found`
        
        return new ResponseBuilder()
            .setSuccess(false)
            .setStatus(statusCodes.NOT_FOUND)
            .setMessage(message)
            .setTimestamp()
    }

    static unauthorized(message: string = 'Unauthorized'): ResponseBuilder {
        return new ResponseBuilder()
            .setSuccess(false)
            .setStatus(statusCodes.UNAUTHORIZED)
            .setMessage(message)
            .setTimestamp()
    }

    static validation(message: string, errors?: any): ResponseBuilder {
        return new ResponseBuilder()
            .setSuccess(false)
            .setStatus(statusCodes.BAD_REQUEST)
            .setMessage(message)
            .setData({ validationErrors: errors })
            .setTimestamp()
    }
}