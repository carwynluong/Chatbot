import { Response, CookieOptions } from "express"
import { NODE_ENV } from "../config/env"
export const setCookie = async (res: Response, accessToken: string, refreshToken: string): Promise<void> => {
    const accessTokenOptions: CookieOptions = {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        sameSite: 'strict',
        expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
    }
    const refreshTokenOptions: CookieOptions = {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        sameSite: 'strict',
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
    res.cookie('accessToken', accessToken, accessTokenOptions)
    res.cookie('refreshToken', refreshToken, refreshTokenOptions)
}
