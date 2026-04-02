import { AZURE_EMBEDDING_DEPLOYMENT_NAME, PINECONE_INDEX_NAME, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY } from '../config/env'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import pineconeService from "../providers/pinecone.connect"
import documentService from "./document.service"
import path from 'path'
import PDFParser from 'pdf2json'
import mammoth from 'mammoth'
import axios from 'axios'
import OpenAI from 'openai'

// OpenAI client - will be initialized only when needed
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
    if (!openaiClient) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY not found in environment variables')
        }
        openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        })
    }
    return openaiClient
}

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
    async processFileDirect(fileName: string, s3Url: string): Promise<void> {
        await this.processSingleFile(fileName, s3Url)
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
    private async processSingleFile(fileName: string, s3Url: string): Promise<void> {
        try {
            console.log(`🚀 Processing single file: ${fileName}`, { s3Url })
            
            // First, delete any existing embeddings for this document  
            console.log(`🧹 Cleaning up existing embeddings for: ${fileName}`)
            try {
                await this.deleteDocumentEmbeddings(fileName)
                console.log(`✅ Cleaned up existing embeddings for: ${fileName}`)
            } catch (cleanupError) {
                console.log(`ℹ️  No existing embeddings to cleanup for: ${fileName}`)
            }
            
            // Create document metadata in DynamoDB
            console.log(`📝 Creating document metadata for: ${fileName}`)
            await documentService.createDocument({
                fileName: fileName,
                fileSize: 0, // Will be updated after processing
                fileType: path.extname(fileName).toLowerCase(),
                s3Key: fileName,
                s3Url: s3Url
            })
            console.log(`✅ Document metadata created for: ${fileName}`)

            console.log(`📖 Extracting content from S3 for: ${fileName}`)
            const content = await this.extractFromS3(s3Url)
            console.log(`📝 Extracted content length: ${content.length} characters`)
            
            console.log(`✂️ Chunking content for: ${fileName}`)
            const chunks = await this.chunkContent(content)
            console.log(`📊 Created ${chunks.length} chunks`)

            // Update document with total chunks
            console.log(`🔄 Updating document status to processing with ${chunks.length} chunks`)
            await documentService.updateDocumentStatus(fileName, 'processing', chunks.length)

            const vectors: PineconeVector[] = []
            
            console.log(`🔢 Starting embedding generation for ${chunks.length} chunks`)
            for (let i = 0; i < chunks.length; i++) {
                console.log(`📍 Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`)
                
                // Add small delay between embedding calls to avoid throttling
                if (i > 0) {
                    const delay = 100 + Math.random() * 200 // 100-300ms random delay
                    await new Promise(resolve => setTimeout(resolve, delay))
                }
                
                const embedding = await this.generateEmbedding(chunks[i])
                console.log(`✅ Generated embedding for chunk ${i + 1}: ${embedding.length} dimensions`)
                
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
            console.log(`📤 Upserting ${vectors.length} vectors to Pinecone index: ${PINECONE_INDEX_NAME}`)
            await this.upsertVectorsToPinecone(vectors)
            console.log(`✅ Successfully upserted ${vectors.length} vectors to Pinecone`)

            // Verify upsert by querying one vector back
            try {
                const testVector = vectors[0]
                const verifyQuery = await this.querySimilarDocuments(testVector.values, 1)
                if (verifyQuery.length > 0) {
                    console.log(`✅ Verification successful - can query back uploaded vectors`)
                } else {
                    console.warn(`⚠️  Verification warning - no vectors returned in test query`)
                }
            } catch (verifyError) {
                console.warn(`⚠️  Could not verify upsert:`, verifyError)
                // Don't throw here, just warn
            }

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
    private async extractFromS3(url: string): Promise<string> {
        try {
            console.log(`📄 Extracting content from S3: ${url}`)
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

    // Generate Embedding with Azure AI Foundry (with OpenAI fallback)
    async generateEmbedding(text: string): Promise<number[]> {
        const maxRetries = 3
        
        // Try Azure first, then OpenAI fallback
        for (let useAzure of [true, false]) {
            if (!useAzure && !process.env.OPENAI_API_KEY) {
                console.log('⚠️  No OpenAI API key found, skipping OpenAI fallback')
                continue
            }
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const source = useAzure ? 'Azure AI' : 'OpenAI Direct'
                    console.log(`🔄 Generating embedding via ${source} (${text.length} chars) - Attempt ${attempt}/${maxRetries}`)
                    
                    let embedding: number[]
                    
                    if (useAzure) {
                        // Try Azure AI Foundry
                        if (!AZURE_EMBEDDING_DEPLOYMENT_NAME) {
                            throw new Error('AZURE_EMBEDDING_DEPLOYMENT_NAME not configured')
                        }
                        embedding = await this.generateAzureEmbedding(text)
                    } else {
                        // Fallback to OpenAI Direct
                        embedding = await this.generateOpenAIEmbedding(text)
                    }
                    
                    console.log(`✅ Generated embedding via ${source} with ${embedding?.length || 0} dimensions`)
                    return embedding
                } catch (error: any) {
                    console.error(`❌ Error generating embedding via ${useAzure ? 'Azure' : 'OpenAI'} (attempt ${attempt}/${maxRetries}):`, error.message)
                    
                    // If it's a 404 (deployment not found), don't retry Azure
                    if (useAzure && (error?.status === 404 || error?.response?.status === 404)) {
                        console.log('🔄 Azure deployment not found, trying OpenAI fallback...')
                        break // Break out of retry loop for Azure, try OpenAI
                    }
                    
                    // Check if it's a throttling error  
                    const isThrottling = error?.status === 429 ||
                                       error?.code === 'TooManyRequests' ||
                                       error?.message?.includes('rate limit') ||
                                       error?.message?.includes('Too many requests')
                    
                    if (isThrottling && attempt < maxRetries) {
                        // Exponential backoff with jitter
                        const delay = 1000 * Math.pow(2, attempt - 1) + Math.random() * 1000
                        console.log(`⏳ Rate limiting detected. Waiting ${Math.round(delay)}ms before retry ${attempt + 1}/${maxRetries}`)
                        await new Promise(resolve => setTimeout(resolve, delay))
                        continue
                    }
                    
                    // If max retries reached for this service, continue to next service
                    if (attempt === maxRetries) {
                        console.error(`💥 Max retries reached for ${useAzure ? 'Azure' : 'OpenAI'}. Moving to next option.`)
                        break
                    }
                }
            }
        }
        
        throw new Error('❌ All embedding services failed. Please check your Azure deployment or OpenAI API key.')
    }
    
    // Azure AI embedding method
    private async generateAzureEmbedding(text: string): Promise<number[]> {
        const url = `${AZURE_OPENAI_ENDPOINT}openai/deployments/${AZURE_EMBEDDING_DEPLOYMENT_NAME}/embeddings?api-version=2024-06-01`
        const response: any = await axios.post(url, {
            input: text,
        }, {
            headers: {
                'Content-Type': 'application/json',
                'api-key': AZURE_OPENAI_API_KEY
            }
        })
        
        if (!response?.data?.data || !Array.isArray(response.data.data) || response.data.data.length === 0) {
            throw new Error('No embedding data returned from Azure AI')
        }

        return response.data.data[0].embedding
    }
    
    // OpenAI direct embedding method 
    private async generateOpenAIEmbedding(text: string): Promise<number[]> {
        const client = getOpenAIClient() // This will create client only when needed
        const response = await client.embeddings.create({
            model: 'text-embedding-3-small',
            input: text,
        })
        
        if (!response?.data || response.data.length === 0) {
            throw new Error('No embedding data returned from OpenAI')
        }

        return response.data[0].embedding
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
                console.log(`🔍 Sample vector IDs in batch:`, batch.slice(0, 3).map(v => v.id))
                
                // Retry mechanism for upsert
                let retries = 3
                let upsertSuccess = false
                
                while (retries > 0 && !upsertSuccess) {
                    try {
                        await index.upsert(batch)
                        console.log(`✅ Batch ${batchNumber}/${totalBatches} upserted successfully`)
                        upsertSuccess = true
                    } catch (upsertError) {
                        retries--
                        console.error(`❌ Upsert failed for batch ${batchNumber}, retries left: ${retries}`, upsertError)
                        
                        if (retries > 0) {
                            // Wait before retry
                            await new Promise(resolve => setTimeout(resolve, 2000))
                        } else {
                            throw upsertError
                        }
                    }
                }
            }
            
            console.log(`✅ Successfully upserted all ${vectors.length} vectors to Pinecone`)
            
            // CRITICAL: Verify upsert immediately 
            console.log(`🔍 Verifying upsert by querying back...`)
            const testVector = vectors[0]
            const queryResponse = await index.query({
                vector: testVector.values,
                topK: 1,
                includeMetadata: true,
                filter: { documentId: { $eq: testVector.metadata.documentId } }
            })
            
            if (queryResponse.matches && queryResponse.matches.length > 0) {
                console.log(`✅ VERIFICATION SUCCESS: Found uploaded vector ${queryResponse.matches[0].id}`)
            } else {
                console.error(`❌ VERIFICATION FAILED: Cannot query back uploaded vectors!`)
                throw new Error('Upsert verification failed - vectors not found in Pinecone')
            }
            
        } catch (error) {
            console.error(`❌ Error upserting vectors to Pinecone:`, {
                error: error,
                message: error instanceof Error ? error.message : 'Unknown error',
                vectorCount: vectors.length,
                sampleVectorIds: vectors.slice(0, 3).map(v => v.id)
            })
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
            console.log(`🔍 Querying Pinecone for similar documents, topK: ${topK}, embedding dims: ${queryEmbedding.length}`)
            
            const index = await pineconeService.getIndex(PINECONE_INDEX_NAME!)
            console.log(`✅ Connected to Pinecone index: ${PINECONE_INDEX_NAME}`)
            
            const queryResponse = await index.query({
                vector: queryEmbedding,
                topK: topK,
                includeMetadata: true,
                includeValues: false
            })
            
            const matches = queryResponse.matches || []
            console.log(`🎯 Found ${matches.length} similar documents:`)
            matches.forEach((match, idx) => {
                console.log(`  ${idx + 1}. Score: ${match.score}, Document: ${match.metadata?.fileName}, Content: ${match.metadata?.content?.substring(0, 100)}...`)
            })

            return matches
        } catch (error) {
            console.error('❌ Error querying Pinecone:', error)
            throw error
        }
    }

    // Delete document embeddings from Pinecone
    async deleteDocumentEmbeddings(documentId: string): Promise<void> {
        try {
            console.log(`🗑️  Deleting embeddings for document: ${documentId}`)
            const index = await pineconeService.getIndex(PINECONE_INDEX_NAME!)
            
            // Delete by metadata filter
            await index.deleteMany({
                filter: {
                    documentId: { $eq: documentId }
                }
            })
            
            console.log(`✅ Deleted embeddings for document: ${documentId}`)

            // Update document status in DynamoDB (only if exists)
            try {
                const existingDoc = await documentService.getDocument(documentId)
                if (existingDoc) {
                    await documentService.deleteDocument(documentId)
                    console.log(`✅ Deleted document metadata: ${documentId}`)
                }
            } catch (dbError) {
                console.log(`ℹ️  No document metadata to delete: ${documentId}`)
            }
            
        } catch (error) {
            console.error(`❌ Error deleting document embeddings: ${documentId}`, error)
            // Don't throw error for cleanup operations
            console.log(`⚠️  Continuing despite cleanup error...`)
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
