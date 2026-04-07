import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb"
import dynamoService from "../providers/dynamodb.connect"
import { IChatRepository } from "../interfaces/IRepository"
import { ChatSession, ChatMessage } from "../models/chat.model"
import { CHAT_TABLE_NAME } from "../config/env"

export class ChatRepository implements IChatRepository {
    private tableName = CHAT_TABLE_NAME!

    async create(input: { userId: string, messages: ChatMessage[], sessionId?: string }): Promise<ChatSession> {
        const now = new Date().toISOString()
        const timestamp = Date.now()
        
        const chatSession: ChatSession = {
            userId: input.userId,
            timestamp,
            sessionId: input.sessionId || `session_${timestamp}`,
            messages: input.messages,
            createdAt: now,
            updatedAt: now
        }

        await dynamoService.getDynamoClient().send(new PutCommand({
            TableName: this.tableName,
            Item: chatSession
        }))

        return chatSession
    }

    async findById(id: string): Promise<ChatSession | null> {
        try {
            const result = await dynamoService.getDynamoClient().send(new GetCommand({
                TableName: this.tableName,
                Key: { userId: id.split(':')[0], timestamp: parseInt(id.split(':')[1]) }
            }))
            return result.Item as ChatSession || null
        } catch (error) {
            console.error('Error finding chat by ID:', error)
            return null
        }
    }

    async findByUser(userId: string): Promise<ChatSession[]> {
        try {
            const result = await dynamoService.getDynamoClient().send(new QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: {
                    ':userId': userId
                },
                ScanIndexForward: false
            }))
            
            return result.Items as ChatSession[] || []
        } catch (error) {
            console.error('Error finding chats by user:', error)
            return []
        }
    }

    async findByUserAndSessionId(userId: string, sessionId: string): Promise<ChatSession | null> {
        try {
            const result = await dynamoService.getDynamoClient().send(new QueryCommand({
                TableName: this.tableName,
                KeyConditionExpression: 'userId = :userId',
                FilterExpression: 'sessionId = :sessionId',
                ExpressionAttributeValues: {
                    ':userId': userId,
                    ':sessionId': sessionId
                }
            }))
            
            return result.Items?.[0] as ChatSession || null
        } catch (error) {
            console.error('Error finding chat by user and session:', error)
            return null
        }
    }

    async update(id: string, updates: Partial<ChatSession>): Promise<void> {
        const [userId, timestampStr] = id.split(':')
        const timestamp = parseInt(timestampStr)

        const updateExpression: string[] = []
        const expressionAttributeNames: any = {}
        const expressionAttributeValues: any = {}

        Object.entries(updates).forEach(([key, value]) => {
            if (key !== 'userId' && key !== 'timestamp') {
                updateExpression.push(`#${key} = :${key}`)
                expressionAttributeNames[`#${key}`] = key
                expressionAttributeValues[`:${key}`] = value
            }
        })

        updateExpression.push('#updatedAt = :updatedAt')
        expressionAttributeNames['#updatedAt'] = 'updatedAt'
        expressionAttributeValues[':updatedAt'] = new Date().toISOString()

        await dynamoService.getDynamoClient().send(new UpdateCommand({
            TableName: this.tableName,
            Key: { userId, timestamp },
            UpdateExpression: `SET ${updateExpression.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues
        }))
    }

    async delete(id: string): Promise<void> {
        const [userId, timestampStr] = id.split(':')
        const timestamp = parseInt(timestampStr)

        await dynamoService.getDynamoClient().send(new DeleteCommand({
            TableName: this.tableName,
            Key: { userId, timestamp }
        }))
    }

    async deleteSession(userId: string, sessionId: string): Promise<void> {
        try {
            // Find all sessions with this sessionId for this user
            const sessions = await this.findByUser(userId)
            const targetSessions = sessions.filter(session => session.sessionId === sessionId)

            // Delete each matching session
            for (const session of targetSessions) {
                await this.delete(`${session.userId}:${session.timestamp}`)
            }
        } catch (error) {
            console.error('Error deleting chat session:', error)
            throw error
        }
    }
}