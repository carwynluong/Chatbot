import { Request, Response } from 'express'
import AuthService from '../services/auth.service'
import statusCodes from '../constants/statusCodes'
import { setCookie } from '../utils/cookie.util'
export class AuthController {


    async register(req: Request, res: Response) {
        try {
            const { email, password, name, role } = req.body
            if (!email || !password || !name) {
                return res.status(statusCodes.BAD_REQUEST).json({
                    message: 'Name, email and password are required'
                })
            }

            const data = await AuthService.register({ email, password, name, role })

            await setCookie(res, data.accessToken, data.refreshToken)

            res.status(statusCodes.CREATED).json(
                {
                    messages: 'User registered successfully',
                    ...data
                }
            )
        } catch (error) {
            console.error('Error in register controller:', error)
            
            return res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
                message: 'Internal server error'
            })
        }
    }

    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body

            if (!email || !password) {
                return res.status(statusCodes.BAD_REQUEST).json({
                    message: 'Email and password are required'
                })
            }

            const data = await AuthService.login(email, password)

            // Set cookie
            await setCookie(res, data.accessToken, data.refreshToken)

            res.status(statusCodes.OK).json({
                message: 'User logged in successfully',
                ...data
            })
        } catch (error) {
            console.error('Error in login controller:', error)
            
            res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
                message: 'Internal server error'
            })
        }
    }

    async refreshToken(req: Request, res: Response) {
        try {
            const refreshToken = req.cookies.refreshToken

            if (!refreshToken) {
                return res.status(statusCodes.UNAUTHORIZED).json({
                    message: 'Refresh token required'
                })
            }

            const data = await AuthService.refreshAccessToken(refreshToken)

            // Set new cookies
            await setCookie(res, data.accessToken, data.refreshToken)

            res.status(statusCodes.OK).json({
                message: 'Token refreshed successfully'
            })
        } catch (error) {
            res.status(statusCodes.UNAUTHORIZED).json({
                message: 'Invalid refresh token'
            })
        }
    }

    async logout(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id
            if (userId) {
                await AuthService.logout(userId)
            }

            res.clearCookie('accessToken')
            res.clearCookie('refreshToken')
            res.status(statusCodes.OK).json({
                message: 'Logout successful'
            })
        } catch (error) {
            res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
                message: 'Logout failed'
            })
        }
    }

    async getProfile(req: Request, res: Response) {
        try {
            const user = (req as any).user
            if (!user) {
                return res.status(statusCodes.UNAUTHORIZED).json({
                    message: 'Unauthorized'
                })
            }
            res.status(statusCodes.OK).json({
                message: 'Get Profile succesfully',
                user
            })
        } catch (error) {
            console.error('Error in getProfile controller:', error)
            res.status(statusCodes.INTERNAL_SERVER_ERROR).json({
                message: 'Internal server error'
            })
        }
    }
}

export default new AuthController()