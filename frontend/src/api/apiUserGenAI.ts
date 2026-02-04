import { create } from 'zustand'
import axios from '../lib/axios'
import toast from 'react-hot-toast'
import type { AuthState } from '../interfaces'


export const useAuth = create<AuthState>((set) => ({

    user: null,
    isLoading: false,
    isAuthenticated: false,

    login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
            const res = await axios.post('/auth/login', {
                email, password
            })

            const { user } = res.data
            console.log("Người dùng: ", user)
            set({ user, isAuthenticated: true, isLoading: false })
            toast.success('Login successful')
        } catch (error) {
            set({ isLoading: false })
            toast.error((error as any).response?.data?.message || 'Login failed:')
            throw error
        }
    },

    register: async (name: string, email: string, password: string) => {
        set({ isLoading: true })
        try {
            const res = await axios.post('/auth/register', {
                name, email, password
            })

            const { user } = res.data

            set({ user, isAuthenticated: true, isLoading: false })
            toast.success('Registration successful')

        } catch (error) {
            set({ isLoading: false })
            toast.error((error as any).response?.data?.message || 'Registration failed:')
            throw error
        }
    },

    logout: async () => {
        try {
            await axios.post('/auth/logout')
            set({ user: null, isAuthenticated: false })
            toast.success('Logout successful')
        } catch (error) {
            set({ user: null, isAuthenticated: false })
            throw error
        }
    },

    checkAuth: async () => {
        try {
            const res = await axios.get('/auth/profile')
            const { user } = res.data
            set({ user, isAuthenticated: true })

        } catch (error) {
            set({ user: null, isAuthenticated: false })
        }
    }
}))
