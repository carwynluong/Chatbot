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

export class QueryBuilder {
    private query: any = {}
    private conditions: any = {}
    private sortOptions: any = {}
    private limitValue: number | undefined
    private offsetValue: number = 0

    static create(): QueryBuilder {
        return new QueryBuilder()
    }

    table(tableName: string): QueryBuilder {
        this.query.TableName = tableName
        return this
    }

    where(field: string, operator: string, value: any): QueryBuilder {
        if (!this.conditions.FilterExpression) {
            this.conditions.FilterExpression = ''
            this.conditions.ExpressionAttributeNames = {}
            this.conditions.ExpressionAttributeValues = {}
        }

        const fieldName = `#${field}`
        const valueName = `:${field}`

        if (this.conditions.FilterExpression) {
            this.conditions.FilterExpression += ' AND '
        }

        switch (operator.toLowerCase()) {
            case 'eq':
            case '=':
                this.conditions.FilterExpression += `${fieldName} = ${valueName}`
                break
            case 'ne':
            case '!=':
                this.conditions.FilterExpression += `${fieldName} <> ${valueName}`
                break
            case 'gt':
            case '>':
                this.conditions.FilterExpression += `${fieldName} > ${valueName}`
                break
            case 'gte':
            case '>=':
                this.conditions.FilterExpression += `${fieldName} >= ${valueName}`
                break
            case 'lt':
            case '<':
                this.conditions.FilterExpression += `${fieldName} < ${valueName}`
                break
            case 'lte':
            case '<=':
                this.conditions.FilterExpression += `${fieldName} <= ${valueName}`
                break
            case 'contains':
                this.conditions.FilterExpression += `contains(${fieldName}, ${valueName})`
                break
            case 'begins_with':
                this.conditions.FilterExpression += `begins_with(${fieldName}, ${valueName})`
                break
            default:
                this.conditions.FilterExpression += `${fieldName} = ${valueName}`
        }

        this.conditions.ExpressionAttributeNames[fieldName] = field
        this.conditions.ExpressionAttributeValues[valueName] = value

        return this
    }

    sort(field: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder {
        this.sortOptions.ScanIndexForward = direction === 'ASC'
        return this
    }

    limit(count: number): QueryBuilder {
        this.limitValue = count
        return this
    }

    offset(count: number): QueryBuilder {
        this.offsetValue = count
        return this
    }

    index(indexName: string): QueryBuilder {
        this.query.IndexName = indexName
        return this
    }

    keyCondition(keyExpression: string, values: Record<string, any>): QueryBuilder {
        this.query.KeyConditionExpression = keyExpression
        
        if (!this.query.ExpressionAttributeValues) {
            this.query.ExpressionAttributeValues = {}
        }
        
        Object.assign(this.query.ExpressionAttributeValues, values)
        return this
    }

    projectFields(...fields: string[]): QueryBuilder {
        if (fields.length > 0) {
            this.query.ProjectionExpression = fields.map(field => `#${field}`).join(', ')
            
            if (!this.query.ExpressionAttributeNames) {
                this.query.ExpressionAttributeNames = {}
            }
            
            fields.forEach(field => {
                this.query.ExpressionAttributeNames[`#${field}`] = field
            })
        }
        return this
    }

    build(): any {
        const finalQuery = { ...this.query }

        // Merge conditions
        if (this.conditions.FilterExpression) {
            finalQuery.FilterExpression = this.conditions.FilterExpression
            finalQuery.ExpressionAttributeNames = {
                ...(finalQuery.ExpressionAttributeNames || {}),
                ...this.conditions.ExpressionAttributeNames
            }
            finalQuery.ExpressionAttributeValues = {
                ...(finalQuery.ExpressionAttributeValues || {}),
                ...this.conditions.ExpressionAttributeValues
            }
        }

        // Add sorting
        if (this.sortOptions.ScanIndexForward !== undefined) {
            finalQuery.ScanIndexForward = this.sortOptions.ScanIndexForward
        }

        // Add pagination
        if (this.limitValue) {
            finalQuery.Limit = this.limitValue
        }

        return finalQuery
    }

    // Convenience methods for common queries
    static findById(tableName: string, id: string, hashKey: string = 'id'): any {
        return {
            TableName: tableName,
            Key: { [hashKey]: id }
        }
    }

    static findByField(tableName: string, field: string, value: any): QueryBuilder {
        return new QueryBuilder()
            .table(tableName)
            .where(field, '=', value)
    }

    static findAll(tableName: string): QueryBuilder {
        return new QueryBuilder().table(tableName)
    }
}