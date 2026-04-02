import { PutCommand, GetCommand, UpdateCommand, QueryCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb"
import { dynamoClient } from "../providers/dynamodb.connect"
import { DocumentMetadata, CreateDocumentInput } from "../models/document.model"
import { DOCUMENT_TABLE_NAME } from "../config/env"

export class DocumentService {
    
    async createDocument(documentData: CreateDocumentInput): Promise<DocumentMetadata> {
        const now = new Date().toISOString()
        const document: DocumentMetadata = {
            id: documentData.s3Key, // Use S3 key as unique ID
            ...documentData,
            totalChunks: 0,
            status: 'processing',
            createdAt: now,
            updatedAt: now
        }

        await dynamoClient.send(new PutCommand({
            TableName: DOCUMENT_TABLE_NAME,
            Item: document
        }))

        return document
    }

    async updateDocumentStatus(
        documentId: string, 
        status: 'processing' | 'embedded' | 'error', 
        totalChunks?: number,
        errorMessage?: string
    ): Promise<void> {
        const updateExpression: string[] = [
            'SET #status = :status',
            '#updatedAt = :updatedAt'
        ]
        const expressionAttributeNames: any = {
            '#status': 'status',
            '#updatedAt': 'updatedAt'
        }
        const expressionAttributeValues: any = {
            ':status': status,
            ':updatedAt': new Date().toISOString()
        }

        if (totalChunks !== undefined) {
            updateExpression.push('#totalChunks = :totalChunks')
            expressionAttributeNames['#totalChunks'] = 'totalChunks'
            expressionAttributeValues[':totalChunks'] = totalChunks
        }

        if (errorMessage) {
            updateExpression.push('#errorMessage = :errorMessage')
            expressionAttributeNames['#errorMessage'] = 'errorMessage'
            expressionAttributeValues[':errorMessage'] = errorMessage
        }

        await dynamoClient.send(new UpdateCommand({
            TableName: DOCUMENT_TABLE_NAME,
            Key: { id: documentId },
            UpdateExpression: updateExpression.join(', '),
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues
        }))
    }

    async getDocument(documentId: string): Promise<DocumentMetadata | null> {
        const result = await dynamoClient.send(new GetCommand({
            TableName: DOCUMENT_TABLE_NAME,
            Key: { id: documentId }
        }))

        return result.Item as DocumentMetadata || null
    }

    async getAllDocuments(): Promise<DocumentMetadata[]> {
        try {
            console.log('📊 Scanning all documents from DynamoDB...')
            console.log('📊 Table name:', DOCUMENT_TABLE_NAME)
            
            const result = await dynamoClient.send(new ScanCommand({
                TableName: DOCUMENT_TABLE_NAME
            }))
            
            const documents = result.Items as DocumentMetadata[] || []
            console.log(`✅ Found ${documents.length} documents`)
            documents.forEach((doc, idx) => {
                console.log(`  ${idx + 1}. ${doc.fileName || doc.id} (Status: ${doc.status})`)
            })
            return documents
        } catch (error) {
            console.error('❌ Error scanning documents from DynamoDB:', {
                error: error,
                message: error instanceof Error ? error.message : 'Unknown error',
                tableName: DOCUMENT_TABLE_NAME
            })
            // Return empty array instead of throwing
            return []
        }
    }

    async listDocuments(): Promise<DocumentMetadata[]> {
        // DynamoDB scan for all documents
        // Note: In production, you might want to use pagination or GSI for better performance
        const result = await dynamoClient.send(new QueryCommand({
            TableName: DOCUMENT_TABLE_NAME,
            // This assumes you have a GSI on status or you're scanning the table
            // For demo purposes, we'll scan (not recommended for production)
        }))

        return result.Items as DocumentMetadata[] || []
    }

    async deleteDocument(documentId: string): Promise<void> {
        await dynamoClient.send(new DeleteCommand({
            TableName: DOCUMENT_TABLE_NAME,
            Key: { id: documentId }
        }))
    }

    async checkDocumentExists(documentId: string): Promise<boolean> {
        const document = await this.getDocument(documentId)
        return document !== null
    }

    async getDocumentsByStatus(status: 'processing' | 'embedded' | 'error'): Promise<DocumentMetadata[]> {
        // This would require a GSI on status field
        const result = await dynamoClient.send(new QueryCommand({
            TableName: DOCUMENT_TABLE_NAME,
            IndexName: 'status-index', // You need to create this GSI
            KeyConditionExpression: '#status = :status',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': status
            }
        }))

        return result.Items as DocumentMetadata[] || []
    }
}

export default new DocumentService()