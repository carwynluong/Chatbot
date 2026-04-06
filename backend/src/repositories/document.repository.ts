import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb"
import { dynamoClient } from "../providers/dynamodb.connect"
import { IDocumentRepository } from "../interfaces/IRepository"
import { DocumentMetadata, CreateDocumentInput } from "../models/document.model"
import { DOCUMENT_TABLE_NAME } from "../config/env"

export class DocumentRepository implements IDocumentRepository {
    private tableName = DOCUMENT_TABLE_NAME!

    async create(input: CreateDocumentInput): Promise<DocumentMetadata> {
        const now = new Date().toISOString()
        const document: DocumentMetadata = {
            id: input.s3Key,
            ...input,
            totalChunks: 0,
            status: 'processing',
            createdAt: now,
            updatedAt: now
        }

        await dynamoClient.send(new PutCommand({
            TableName: this.tableName,
            Item: document
        }))

        return document
    }

    async findById(id: string): Promise<DocumentMetadata | null> {
        try {
            const result = await dynamoClient.send(new GetCommand({
                TableName: this.tableName,
                Key: { id }
            }))
            return result.Item as DocumentMetadata || null
        } catch (error) {
            console.error('Error finding document by ID:', error)
            return null
        }
    }

    async findByStatus(status: 'processing' | 'embedded' | 'error'): Promise<DocumentMetadata[]> {
        try {
            const result = await dynamoClient.send(new QueryCommand({
                TableName: this.tableName,
                IndexName: 'StatusIndex',
                KeyConditionExpression: '#status = :status',
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ExpressionAttributeValues: {
                    ':status': status
                }
            }))
            
            return result.Items as DocumentMetadata[] || []
        } catch (error) {
            console.error('Error finding documents by status:', error)
            return []
        }
    }

    async findByUser(userId: string): Promise<DocumentMetadata[]> {
        try {
            const result = await dynamoClient.send(new ScanCommand({
                TableName: this.tableName,
                FilterExpression: '#userId = :userId',
                ExpressionAttributeNames: {
                    '#userId': 'userId'
                },
                ExpressionAttributeValues: {
                    ':userId': userId
                }
            }))
            
            return result.Items as DocumentMetadata[] || []
        } catch (error) {
            console.error('Error finding documents by user:', error)
            return []
        }
    }

    async update(id: string, updates: Partial<DocumentMetadata>): Promise<void> {
        const updateExpression: string[] = []
        const expressionAttributeNames: any = {}
        const expressionAttributeValues: any = {}

        Object.entries(updates).forEach(([key, value]) => {
            if (key !== 'id') {
                updateExpression.push(`#${key} = :${key}`)
                expressionAttributeNames[`#${key}`] = key
                expressionAttributeValues[`:${key}`] = value
            }
        })

        updateExpression.push('#updatedAt = :updatedAt')
        expressionAttributeNames['#updatedAt'] = 'updatedAt'
        expressionAttributeValues[':updatedAt'] = new Date().toISOString()

        await dynamoClient.send(new UpdateCommand({
            TableName: this.tableName,
            Key: { id },
            UpdateExpression: `SET ${updateExpression.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues
        }))
    }

    async updateStatus(
        id: string, 
        status: 'processing' | 'embedded' | 'error', 
        totalChunks?: number,
        errorMessage?: string
    ): Promise<void> {
        const updates: Partial<DocumentMetadata> = { status }
        
        if (totalChunks !== undefined) {
            updates.totalChunks = totalChunks
        }
        
        if (errorMessage !== undefined) {
            updates.errorMessage = errorMessage
        }

        await this.update(id, updates)
    }

    async delete(id: string): Promise<void> {
        await dynamoClient.send(new DeleteCommand({
            TableName: this.tableName,
            Key: { id }
        }))
    }
}