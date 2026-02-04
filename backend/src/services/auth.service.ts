import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { dynamoClient } from "../providers/dynamodb.connect"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { User, CreateUserInput } from "../models/user.model"
import { JWT_SECRET, USER_TABLE_NAME, REFRESH_TOKEN_SECRET } from "../config/env"
import { AuthError, ConflictError } from '../utils/error.utils'
// import { CreateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb"


export class AuthService {

    private generateTokens(user: Omit<User, 'password'>){
        const accessToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET!,
            { expiresIn: '1d' } // Access token hết hạn sau 15 phút
        )

        const refreshToken = jwt.sign(
            { id: user.id, email: user.email },
            REFRESH_TOKEN_SECRET!,
            { expiresIn: '7d' } // Refresh token hết hạn sau 7 ngày
        )

        return { accessToken, refreshToken }
    }

    async register(userData: CreateUserInput): Promise<{ user: Omit<User, 'password'>, accessToken: string, refreshToken: string }> {
        const { name, email, password, role = 'user' } = userData

        // Check if user already exists
        const existingUser = await this.getUserByEmail(email)
        if (existingUser) {
            throw new ConflictError('User already exists')
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        const now = new Date().toISOString()
        const newUser: User = {
            id: `user_${Date.now()}`,
            name,
            email,
            password: hashedPassword,
            role,
            createdAt: now,
            updatedAt: now
        }

        await dynamoClient.send(new PutCommand({
            TableName: USER_TABLE_NAME,
            Item: newUser
        }))

        
        const { password: _, refreshToken: __, ...userWithoutPassword } = newUser
        const { accessToken, refreshToken } = this.generateTokens(userWithoutPassword)

        // Lưu refresh token vào database
        await this.saveRefreshToken(newUser.id, refreshToken)

        return { user: userWithoutPassword, accessToken, refreshToken }
    }

    async login(email: string, password: string): Promise<{ user: Omit<User, 'password'>, accessToken: string, refreshToken: string }> {
        const user = await this.getUserByEmail(email)
        if (!user) {
            throw new AuthError('Invalid email or password')
        }
        const isValidPassword = await bcrypt.compare(password, user.password)
        if (!isValidPassword) {
            throw new AuthError('Invalid email or password')
        }
        
        const { password: _, refreshToken: __, ...userWithoutPassword } = user
        const { accessToken, refreshToken } = this.generateTokens(userWithoutPassword)

        // Lưu refresh token vào database
        await this.saveRefreshToken(user.id, refreshToken)

        return { user: userWithoutPassword, accessToken, refreshToken }
    }

    async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string, refreshToken: string }> {
        try {
            const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET!) as any

            // Kiểm tra refresh token có tồn tại trong database
            const user = await this.getUserById(decoded.id)
            if (!user || user.refreshToken !== refreshToken) {
                throw new AuthError('Invalid refresh token')
            }

            const { password: _, refreshToken: __, ...userWithoutPassword } = user
            const tokens = this.generateTokens(userWithoutPassword)

            await this.saveRefreshToken(user.id, tokens.refreshToken)

            return tokens

        } catch (error) {
            throw new AuthError('Invalid or expired refresh token')
        }
    }

    private async saveRefreshToken(userId: string, refreshToken: string){
        await dynamoClient.send(new UpdateCommand({
            TableName: USER_TABLE_NAME,
            Key: { id: userId },
            UpdateExpression: 'SET refreshToken = :refreshToken, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':refreshToken': refreshToken,
                ':updatedAt': new Date().toISOString()
            }
        }))
    }

    private async getUserById(id: string): Promise<User | null>{
        const data = await dynamoClient.send(new QueryCommand({
            TableName: USER_TABLE_NAME,
            KeyConditionExpression: 'id = :id',
            ExpressionAttributeValues: { ':id': id }
        }))
        return data.Items?.[0] as User || null
    }


    private async getUserByEmail(email: string): Promise<User | null> {
        const result = await dynamoClient.send(new QueryCommand({
            TableName: USER_TABLE_NAME,
            IndexName: 'email-index',
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: { ':email': email }
        }))

        return result.Items?.[0] as User || null
    }

    async logout(userId: string) {
        await dynamoClient.send(new UpdateCommand({
            TableName: USER_TABLE_NAME,
            Key: { id: userId },
            UpdateExpression: 'REMOVE refreshToken SET updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':updatedAt': new Date().toISOString()
            }
        }))
    }
}

export default new AuthService()