export interface User {
    id: string
    name: string
    email: string
    password: string
    role: 'user' | 'admin'
    refreshToken?: string
    createdAt: string
    updatedAt: string
}

export interface CreateUserInput {
    name: string
    email: string
    password: string
    role?: 'user' | 'admin'
}