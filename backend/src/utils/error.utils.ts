export class AppError extends Error {
    public statusCode: number
    public isOperational: boolean

    constructor(message: string, statusCode: number) {
        super(message)
        this.statusCode = statusCode
        this.isOperational = true

        Error.captureStackTrace(this, this.constructor)
    }
}

export class AuthError extends AppError {
    constructor(message: string = 'Authentication failed') {
        super(message, 401)
    }
}

export class ValidationError extends AppError {
    constructor(message: string = 'Validation failed') {
        super(message, 400)
    }
}

export class ConflictError extends AppError {
    constructor(message: string = 'Resource already exists') {
        super(message, 409)
    }
}
