import axios from '../lib/axios'
import type {
    MultipleUploadResponse,
    ListFilesResponse,
    FileUrlResponse
} from '../interfaces/upload.interface'

export class UploadGenAIAPI {
    async uploadFile(file: File): Promise<any> {
        const formData = new FormData()
        formData.append('file', file)

        const res = await axios.post('/s3/uploads', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })
        return res.data
    }

    async uploadMultipleFiles(files: File[]): Promise<MultipleUploadResponse> {
        const formData = new FormData()
        files.forEach(file => {
            formData.append('file', file)
        })

        const res = await axios.post<MultipleUploadResponse>('/s3/uploads', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })
        return res.data
    }

    async listFiles(): Promise<ListFilesResponse> {
        const res = await axios.get<{ data: ListFilesResponse }>('/s3/list-object')
        return res.data.data // Extract the data property from ResponseBuilder format
    }

    async getFileUrl(key: string): Promise<FileUrlResponse> {
        // Encode the key to base64 to handle special characters and slashes
        const encodedKey = btoa(encodeURIComponent(key))
        const res = await axios.get<FileUrlResponse>(`/s3/file/${encodedKey}`)
        return res.data
    }

    async deleteFile(key: string): Promise<any> {
        // Encode the key to base64 to handle special characters and slashes
        const encodedKey = btoa(encodeURIComponent(key))
        console.log('🔍 Deleting file:', { originalKey: key, encodedKey })
        const res = await axios.delete(`/s3/file/${encodedKey}`)
        return res.data
    }
}

export default new UploadGenAIAPI()