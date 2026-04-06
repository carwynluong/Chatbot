import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb"
import { dynamoClient } from "../providers/dynamodb.connect"
import { IUserRepository } from "../interfaces/IRepository"
import { User, CreateUserInput } from "../models/user.model"
import { USER_TABLE_NAME } from "../config/env"

export class UserRepository implements IUserRepository {
    private tableName = USER_TABLE_NAME!

    async create(input: CreateUserInput): Promise<User> {
        const now = new Date().toISOString()
        const user: User = {
            id: `user_${Date.now()}`,
            name: input.name,
            email: input.email,
            password: input.password,
            role: input.role || 'user',
            createdAt: now,
            updatedAt: now
        }

        await dynamoClient.send(new PutCommand({
            TableName: this.tableName,
            Item: user
        }))

        return user
    }

    async findById(id: string): Promise<User | null> {
        try {
            const result = await dynamoClient.send(new GetCommand({
                TableName: this.tableName,
                Key: { id }
            }))
            return result.Item as User || null
        } catch (error) {
            console.error('Error finding user by ID:', error)
            return null
        }
    }

    async findByEmail(email: string): Promise<User | null> {
        try {
            // Use Scan instead of Query since EmailIndex GSI doesn't exist
            const result = await dynamoClient.send(new ScanCommand({
                TableName: this.tableName,
                FilterExpression: 'email = :email',
                ExpressionAttributeValues: {
                    ':email': email
                }
            }))
            
            return result.Items?.[0] as User || null
        } catch (error) {
            console.error('Error finding user by email:', error)
            return null
        }
    }

    async update(id: string, updates: Partial<User>): Promise<void> {
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

    async updateRefreshToken(id: string, refreshToken: string): Promise<void> {
        await this.update(id, { refreshToken })
    }

    async delete(id: string): Promise<void> {
        await dynamoClient.send(new DeleteCommand({
            TableName: this.tableName,
            Key: { id }
        }))
    }
}