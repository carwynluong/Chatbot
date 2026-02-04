import axios from 'axios'

const axiosInstance = axios.create({
    baseURL: "/api/v1",
    withCredentials: true,
    timeout: 50000
})

export default axiosInstance