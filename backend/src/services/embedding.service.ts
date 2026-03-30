import { EMBEDDING_MODELID, PINECONE_INDEX_NAME } from '../config/env'
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import bedrockClient from "../providers/bedrock.connect"
import pineconeService from "../providers/pinecone.connect"
import documentService from "./document.service"
import path from 'path'
import PDFParser from 'pdf2json'
import mammoth from 'mammoth'
import axios from 'axios'

interface PineconeVector {
    id: string
    values: number[]
    metadata: {
        documentId: string
        chunkIndex: number
        content: string
        fileName: string
        fileType: string
    }
}

export class EmbeddingService {
    private processingQueue: Set<string> = new Set()

    constructor() {
        // Check Pinecone connection
        this.initializePinecone().catch(error => {
            console.warn('⚠️  Pinecone initialization failed:', error.message)
        })
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
        try {
            // Create document metadata in DynamoDB
            await documentService.createDocument({
                fileName: fileName,
                fileSize: 0, // Will be updated after processing
                fileType: path.extname(fileName).toLowerCase(),
                s3Key: fileName,
                s3Url: cloudFrontUrl
            })

            const content = await this.extractFromCloudFront(cloudFrontUrl)
            const chunks = await this.chunkContent(content)

            // Update document with total chunks
            await documentService.updateDocumentStatus(fileName, 'processing', chunks.length)

            const vectors: PineconeVector[] = []
            
            for (let i = 0; i < chunks.length; i++) {
                const embedding = await this.generateEmbedding(chunks[i])
                const vectorId = `${fileName}_chunk_${i}`
                
                vectors.push({
                    id: vectorId,
                    values: embedding,
                    metadata: {
                        documentId: fileName,
                        chunkIndex: i,
                        content: chunks[i],
                        fileName: fileName,
                        fileType: path.extname(fileName).toLowerCase()
                    }
                })
            }

            // Upsert vectors to Pinecone in batches
            await this.upsertVectorsToPinecone(vectors)

            // Update document status to embedded
            await documentService.updateDocumentStatus(fileName, 'embedded', chunks.length)

            console.log(`✅ Successfully processed and embedded file: ${fileName}`)
            
        } catch (error) {
            console.error(`❌ Error processing file ${fileName}:`, error)
            await documentService.updateDocumentStatus(
                fileName, 
                'error', 
                0, 
                error instanceof Error ? error.message : 'Unknown error'
            )
            throw error
        } finally {
            this.processingQueue.delete(fileName)
        }
    }

    // Get data from S3 
    private async extractFromCloudFront(url: string): Promise<string> {
        try {
            console.log(`📄 Extracting content from: ${url}`)
            const response = await axios.get(url, { responseType: 'arraybuffer' })
            const buffer = Buffer.from(response.data as ArrayBuffer)
            const fileExtension = path.extname(url).toLowerCase()
            
            console.log(`📄 File extension: ${fileExtension}`)
            console.log(`📄 File size: ${buffer.length} bytes`)

            switch (fileExtension) {
                case '.pdf':
                    return await this.extractPdfText(buffer)
                case '.docx':
                    const result = await mammoth.extractRawText({ buffer })
                    console.log(`📄 Extracted ${result.value.length} characters from DOCX file`)
                    return result.value
                case '.txt':
                    const textContent = buffer.toString('utf-8')
                    console.log(`📄 Extracted ${textContent.length} characters from TXT file`)
                    return textContent
                default:
                    console.log(`⚠️  Unknown file type ${fileExtension}, treating as text`)
                    return buffer.toString('utf-8')
            }
        } catch (error) {
            console.error(`❌ Error extracting content from ${url}:`, error)
            throw new Error(`Failed to extract content: ${error instanceof Error ? error.message : error}`)
        }
    }

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
        try {
            console.log(`🔄 Generating embedding for text chunk (${text.length} characters)`)
            const command = new InvokeModelCommand({
                modelId: EMBEDDING_MODELID,
                body: JSON.stringify({ inputText: text }),
                contentType: 'application/json'
            })

            const res = await bedrockClient.send(command)
            const data = JSON.parse(new TextDecoder().decode(res.body))
            console.log(`✅ Generated embedding with ${data.embedding?.length || 0} dimensions`)
            return data.embedding
        } catch (error) {
            console.error(`❌ Error generating embedding:`, error)
            throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : error}`)
        }
    }

    // Upsert vectors to Pinecone
    private async upsertVectorsToPinecone(vectors: PineconeVector[]): Promise<void> {
        try {
            console.log(`🔄 Upserting ${vectors.length} vectors to Pinecone index: ${PINECONE_INDEX_NAME}`)
            const index = await pineconeService.getIndex(PINECONE_INDEX_NAME!)
            
            // Upsert in batches of 100 (Pinecone limit)
            const batchSize = 100
            for (let i = 0; i < vectors.length; i += batchSize) {
                const batch = vectors.slice(i, i + batchSize)
                const batchNumber = Math.floor(i / batchSize) + 1
                const totalBatches = Math.ceil(vectors.length / batchSize)
                
                console.log(`🔄 Upserting batch ${batchNumber}/${totalBatches} (${batch.length} vectors)`)
                
                await index.upsert(batch)
                
                console.log(`✅ Batch ${batchNumber}/${totalBatches} completed`)
            }
            
            console.log(`✅ Successfully upserted all ${vectors.length} vectors to Pinecone`)
        } catch (error) {
            console.error(`❌ Error upserting vectors to Pinecone:`, error)
            throw new Error(`Failed to upsert vectors to Pinecone: ${error instanceof Error ? error.message : error}`)
        }
    }

    // Initialize Pinecone connection
    private async initializePinecone(): Promise<void> {
        try {
            await pineconeService.healthCheck()
            console.log('✅ Pinecone initialized successfully')
        } catch (error) {
            console.warn('⚠️  Failed to initialize Pinecone:', error)
            throw error
        }
    }

    // Query similar documents from Pinecone
    async querySimilarDocuments(queryEmbedding: number[], topK: number = 5): Promise<any[]> {
        try {
            const index = await pineconeService.getIndex(PINECONE_INDEX_NAME!)
            
            const queryResponse = await index.query({
                vector: queryEmbedding,
                topK: topK,
                includeMetadata: true,
                includeValues: false
            })

            return queryResponse.matches || []
        } catch (error) {
            console.error('Error querying Pinecone:', error)
            throw error
        }
    }

    // Delete document embeddings from Pinecone
    async deleteDocumentEmbeddings(documentId: string): Promise<void> {
        try {
            const index = await pineconeService.getIndex(PINECONE_INDEX_NAME!)
            
            // Delete by metadata filter
            await index.deleteMany({
                filter: {
                    documentId: { $eq: documentId }
                }
            })

            // Update document status
            await documentService.deleteDocument(documentId)
            
            console.log(`✅ Deleted embeddings for document: ${documentId}`)
        } catch (error) {
            console.error(`❌ Error deleting document embeddings: ${documentId}`, error)
            throw error
        }
    }

    // Health check for service
    async healthCheck(): Promise<boolean> {
        try {
            return await pineconeService.healthCheck()
        } catch (error) {
            console.error('Embedding service health check failed:', error)
            return false
        }
    }
}

export default new EmbeddingService()
