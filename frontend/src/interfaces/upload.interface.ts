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
  files: FileItem[];
  count: number;
  embedded: number;
}

export interface FileItem {
  key: string;
  size: number;
  url: string;
  name: string;
  isEmbedded: boolean;
  status?: string;
  fileType?: string;
  totalChunks?: number;
  lastModified: string;
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
