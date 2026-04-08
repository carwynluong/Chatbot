import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config/env'
import statusCodes from '../constants/statusCodes'
import messages from '../constants/messages'

export interface AuthRequest extends Request {
    user?: {
        id: string
        email: string
        role: string
    }
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {        
        const header = req.headers.authorization
        const token = header?.startsWith('Bearer ') ? header.substring(7) : req.cookies.accessToken
        
        if (!token) {
            return res.status(statusCodes.UNAUTHORIZED)
                .json({ message: messages[statusCodes.UNAUTHORIZED] })
        }
        const decoded = jwt.verify(token, JWT_SECRET!) as any
        
        req.user = decoded
        next()

    } catch (error) {
        console.log("Error in protectRoute middleware:", error)
        if (error instanceof Error) {
            if (error.name === 'TokenExpiredError') {
                // Access token hết hạn, thử refresh
                return res.status(statusCodes.UNAUTHORIZED).json({
                    message: 'Access token expired',
                    code: 'TOKEN_EXPIRED'
                });
            }
        }
        return res.status(statusCodes.UNAUTHORIZED)
            .json({ message: messages[statusCodes.UNAUTHORIZED] })
    }
}