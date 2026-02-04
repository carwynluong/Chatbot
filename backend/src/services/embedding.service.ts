import pool from "../providers/postgresql.connect"
import { EMBEDDING_MODELID } from '../config/env'
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import bedrockClient from "../providers/bedrock.connect"
import path from 'path'
import PDFParser from 'pdf2json'
import mammoth from 'mammoth'
import axios from 'axios'
export class EmbeddingService {

    constructor() {
        this.initializeDatabase().catch(console.error)
    }

    // Process file
    async processFileDirect(fileName: string, cloudFrontUrl: string): Promise<void> {
        await this.processSingleFile(fileName, cloudFrontUrl)
    }
    // Process multifile
    async processMultipleFilesDirect(fileUrls: { key: string, url: string }[]): Promise<void> {
        const results = await Promise.allSettled(
            fileUrls.map(file => this.processSingleFile(file.key, file.url))
        )

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Error processing file ${fileUrls[index].key}:`, result.reason)
            }
        })
    }

    // Process once file from S3 service
    private async processSingleFile(fileName: string, cloudFrontUrl: string): Promise<void> {
        const content = await this.extractFromCloudFront(cloudFrontUrl)
        const chunks = await this.chunkContent(content)

        const embeddings = await Promise.all(
            chunks.map(chunk => this.generateEmbedding(chunk))
        )

        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            for (let i = 0; i < chunks.length; i++) {
                await this.saveEmbedding(client, fileName, i, chunks[i], embeddings[i])
            }
            await client.query('COMMIT')
        } catch (error) {
            await client.query('ROLaLBACK')
            throw error
        } finally {
            client.release()
        }
    }
    // Get data from S3 
    private async extractFromCloudFront(url: string): Promise<string> {
        const response = await axios.get(url, { responseType: 'arraybuffer' })
        const buffer = Buffer.from(response.data as ArrayBuffer)
        // Nó tách phần đuôi file (extension) từ đường dẫn hoặc URL.
        const fileExtension = path.extname(url).toLowerCase()

        switch (fileExtension) {
            case '.pdf':
                return await this.extractPdfText(buffer)
            case '.docx':
                const result = await mammoth.extractRawText({ buffer })
                return result.value
            case '.txt':
                return buffer.toString('utf-8')
            default:
                return buffer.toString('utf-8')
        }
    }
    // https://github.com/modesty/pdf2json
    private async extractPdfText(buffer: Buffer): Promise<string> {
        return new Promise((resolve, reject) => {
            const pdfParser = new PDFParser()
            
            pdfParser.on('pdfParser_dataError', (errData: any) => {
                reject(new Error(errData.parserError))
            })
            
            pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
                let text = ''
                pdfData.Pages.forEach((page: any) => {
                    page.Texts.forEach((textItem: any) => {
                        textItem.R.forEach((textRun: any) => {
                            text += decodeURIComponent(textRun.T) + ' '
                        })
                    })
                })
                resolve(text.trim())
            })
            
            pdfParser.parseBuffer(buffer)
        })
    }
    // Chunk content 
    private async chunkContent(content: string): Promise<string[]> {
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 100
        })
        return await splitter.splitText(content)
    }
    // Generate Embedding with amazon bedrock
    async generateEmbedding(text: string): Promise<number[]> {
        const command = new InvokeModelCommand({
            modelId: EMBEDDING_MODELID,
            body: JSON.stringify({ inputText: text }),
            contentType: 'application/json'
        })

        const res = await bedrockClient.send(command)
        const data = JSON.parse(new TextDecoder().decode(res.body))
        return data.embedding
    }
    // Save to postgresql
    private async saveEmbedding(client: any, filename: string, chunkIndex: number, content: string, embedding: number[]): Promise<void> {
        const query = `
            INSERT INTO document_embeddings (file_name, chunk_index, content, embedding)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (file_name, chunk_index) DO NOTHING
        `
        const embeddingStr = `[${embedding.join(',')}]`
        await client.query(query, [filename, chunkIndex, content, embeddingStr])
    }
    // Create Table to database
    async initializeDatabase(): Promise<void> {
        const createTableQuery = `
            CREATE EXTENSION IF NOT EXISTS vector;
            
            CREATE TABLE IF NOT EXISTS document_embeddings (
                id SERIAL PRIMARY KEY,
                file_name VARCHAR(255) NOT NULL,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                embedding vector(1536),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (file_name, chunk_index)
            );
            
            CREATE INDEX IF NOT EXISTS idx_document_embeddings_file ON document_embeddings(file_name);
            CREATE INDEX IF NOT EXISTS idx_document_embeddings_embedding ON document_embeddings USING ivfflat (embedding vector_cosine_ops);
        `
        await pool.query(createTableQuery)
    }
}
