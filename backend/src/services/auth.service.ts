import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { User, CreateUserInput } from "../models/user.model"
import { JWT_SECRET, REFRESH_TOKEN_SECRET } from "../config/env"
import { UserRepository } from "../repositories/user.repository"
import { ResponseBuilder } from "../utils/builders"
import { ErrorFactory } from "../utils/pattern.factories"

export class AuthService {
    private userRepository: UserRepository
    private errorFactory: ErrorFactory

    constructor() {
        this.userRepository = new UserRepository()
        this.errorFactory = new ErrorFactory()
    }

    private generateTokens(user: Omit<User, 'password'>){
        const accessToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET!,
            { expiresIn: '1d' }
        )

        const refreshToken = jwt.sign(
            { id: user.id, email: user.email },
            REFRESH_TOKEN_SECRET!,
            { expiresIn: '7d' }
        )

        return { accessToken, refreshToken }
    }

    async register(userData: CreateUserInput): Promise<{ user: Omit<User, 'password'>, accessToken: string, refreshToken: string }> {
        const { name, email, password, role = 'user' } = userData

        // Check if user already exists
        const existingUser = await this.userRepository.findByEmail(email)
        if (existingUser) {
            throw this.errorFactory.createValidationError('User already exists', 'email')
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        const userInput: CreateUserInput = {
            name,
            email,
            password: hashedPassword,
            role
        }

        const newUser = await this.userRepository.create(userInput)
        
        // Create user object without password for response
        const userWithoutPassword: Omit<User, 'password'> = {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            createdAt: newUser.createdAt,
            updatedAt: newUser.updatedAt
        }

        const tokens = this.generateTokens(userWithoutPassword)

        // Save refresh token
        await this.userRepository.updateRefreshToken(newUser.id, tokens.refreshToken)

        return { user: userWithoutPassword, ...tokens }
    }

    async login(email: string, password: string): Promise<{ user: Omit<User, 'password'>, accessToken: string, refreshToken: string }> {
        const user = await this.userRepository.findByEmail(email)
        if (!user) {
            throw this.errorFactory.createAuthenticationError('Invalid email or password')
        }

        const isValidPassword = await bcrypt.compare(password, user.password)
        if (!isValidPassword) {
            throw this.errorFactory.createAuthenticationError('Invalid email or password')
        }
        
        const userWithoutPassword: Omit<User, 'password'> = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        }

        const tokens = this.generateTokens(userWithoutPassword)

        // Save refresh token
        await this.userRepository.updateRefreshToken(user.id, tokens.refreshToken)

        return { user: userWithoutPassword, ...tokens }
    }

    async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string, refreshToken: string }> {
        try {
            const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET!) as any

            // Check if refresh token exists in database
            const user = await this.userRepository.findById(decoded.id)
            if (!user || user.refreshToken !== refreshToken) {
                throw this.errorFactory.createAuthenticationError('Invalid refresh token')
            }

            const userWithoutPassword: Omit<User, 'password'> = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }

            const tokens = this.generateTokens(userWithoutPassword)

            await this.userRepository.updateRefreshToken(user.id, tokens.refreshToken)

            return tokens

        } catch (error) {
            throw this.errorFactory.createAuthenticationError('Invalid or expired refresh token')
        }
    }

    async logout(userId: string): Promise<void> {
        await this.userRepository.update(userId, { refreshToken: undefined })
    }
}

export default new AuthService()