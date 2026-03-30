import axios from 'axios'

const axiosInstance = axios.create({
    baseURL: "/api/v1",
    withCredentials: true,
    timeout: 50000
})

// Request interceptor to add auth headers
axiosInstance.interceptors.request.use(
    (config) => {
        // Try to get access token from cookies
        const cookies = document.cookie.split(';')
        const accessTokenCookie = cookies.find(cookie => cookie.trim().startsWith('accessToken='))
        const accessToken = accessTokenCookie?.split('=')[1]
        
        if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`
        }
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// Response interceptor to handle token refresh
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config
        
        if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
            original._retry = true
            
            try {
                await axiosInstance.post('/auth/refresh')
                return axiosInstance(original)
            } catch (refreshError) {
                // Refresh failed, redirect to login
                window.location.href = '/login'
                return Promise.reject(refreshError)
            }
        }
        
        return Promise.reject(error)
    }
)

export default axiosInstance