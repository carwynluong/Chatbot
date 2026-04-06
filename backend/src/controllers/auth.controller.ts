import { Request, Response } from 'express'
import AuthService from '../services/auth.service'
import { ResponseBuilder } from '../utils/builders'
import { ErrorFactory } from '../utils/pattern.factories'
import { setCookie } from '../utils/cookie.util'

export class AuthController {
    private authService: typeof AuthService
    private errorFactory: ErrorFactory

    constructor() {
        this.authService = AuthService
        this.errorFactory = new ErrorFactory()
    }

    async register(req: Request, res: Response) {
        try {
            const { email, password, name, role } = req.body
            
            // Validation
            if (!email || !password || !name) {
                return ResponseBuilder.validation('Name, email and password are required')
                    .send(res)
            }

            // Register user
            const data = await this.authService.register({ email, password, name, role })

            // Set cookies
            await setCookie(res, data.accessToken, data.refreshToken)

            // Send response
            ResponseBuilder.success({
                user: data.user,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken
            }, 'User registered successfully')
                .setStatus(201)
                .send(res)

        } catch (error) {
            console.error('❌ Error in register controller:', error)
            
            if ((error as any).name === 'ValidationError') {
                ResponseBuilder.validation((error as Error).message)
                    .send(res)
            } else {
                ResponseBuilder.error('Registration failed')
                    .setStatus(500)
                    .send(res)
            }
        }
    }

    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body

            // Validation
            if (!email || !password) {
                return ResponseBuilder.validation('Email and password are required')
                    .send(res)
            }

            // Login user
            const data = await this.authService.login(email, password)

            // Set cookies
            await setCookie(res, data.accessToken, data.refreshToken)

            // Send response
            ResponseBuilder.success({
                user: data.user,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken
            }, 'Login successful')
                .send(res)

        } catch (error) {
            console.error('❌ Error in login controller:', error)
            
            if ((error as any).name === 'AuthenticationError') {
                ResponseBuilder.unauthorized((error as Error).message)
                    .send(res)
            } else {
                ResponseBuilder.error('Login failed')
                    .setStatus(500)
                    .send(res)
            }
        }
    }

    async refreshToken(req: Request, res: Response) {
        try {
            const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken

            if (!refreshToken) {
                return ResponseBuilder.unauthorized('Refresh token is required')
                    .send(res)
            }

            // Refresh tokens
            const tokens = await this.authService.refreshAccessToken(refreshToken)

            // Set new cookies
            await setCookie(res, tokens.accessToken, tokens.refreshToken)

            // Send response
            ResponseBuilder.success(tokens, 'Tokens refreshed successfully')
                .send(res)

        } catch (error) {
            console.error('❌ Error in refresh token controller:', error)
            
            if ((error as any).name === 'AuthenticationError') {
                ResponseBuilder.unauthorized((error as Error).message)
                    .send(res)
            } else {
                ResponseBuilder.error('Token refresh failed')
                    .setStatus(500)
                    .send(res)
            }
        }
    }

    async logout(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id

            if (!userId) {
                return ResponseBuilder.unauthorized('User not authenticated')
                    .send(res)
            }

            // Logout user
            await this.authService.logout(userId)

            // Clear cookies
            res.clearCookie('accessToken')
            res.clearCookie('refreshToken')

            // Send response
            ResponseBuilder.success(null, 'Logged out successfully')
                .send(res)

        } catch (error) {
            console.error('❌ Error in logout controller:', error)
            
            ResponseBuilder.error('Logout failed')
                .setStatus(500)
                .send(res)
        }
    }

    async getProfile(req: Request, res: Response) {
        try {
            const user = (req as any).user

            if (!user) {
                return ResponseBuilder.unauthorized('User not authenticated')
                    .send(res)
            }

            // Send user profile
            ResponseBuilder.success({
                id: user.id,
                email: user.email,
                role: user.role
            }, 'Profile retrieved successfully')
                .send(res)

        } catch (error) {
            console.error('❌ Error in get profile controller:', error)
            
            ResponseBuilder.error('Failed to get profile')
                .setStatus(500)
                .send(res)
        }
    }
}

export default new AuthController()