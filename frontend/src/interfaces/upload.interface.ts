// Upload interface definitions
export interface UploadFileResponse {
  key: string;
  url: string;
}

export interface MultipleUploadResponse {
  message: string;
  files: UploadFileResponse[];
}

export interface ListFilesResponse {
  message: string;
  files: {
    key: string;
    size: number;
    url: string;
    isEmbedded?: boolean;
    // Additional metadata
    fileName?: string;
    fileType?: string;
    status?: string;
    totalChunks?: number;
    createdAt?: string;
    updatedAt?: string;
  }[];
}

export interface FileUrlResponse {
  message: string;
  url: string;
}

export interface EmbeddingResponse {
  message: string;
}

export interface FileItem {
  key: string;
  size: number;
  url: string;
  isEmbedded?: boolean;
  name?: string;
  // Additional metadata
  fileName?: string;
  fileType?: string;
  status?: string;
  totalChunks?: number;
  createdAt?: string;
  updatedAt?: string;
}
