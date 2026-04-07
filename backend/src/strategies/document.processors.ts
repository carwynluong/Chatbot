import { IDocumentProcessor } from "../interfaces/IStrategy"
import PDFParser from 'pdf2json'
import mammoth from 'mammoth'

export class PDFProcessor implements IDocumentProcessor {
    canProcess(fileType: string): boolean {
        return fileType.toLowerCase() === 'pdf' || fileType === 'application/pdf'
    }

    async extractText(buffer: Buffer): Promise<string> {
        return new Promise((resolve, reject) => {
            const pdfParser = new PDFParser()
            
            pdfParser.on('pdfParser_dataError', (error) => {
                const errorMessage = (error as any).parserError || error
                reject(new Error(`PDF parsing error: ${errorMessage}`))
            })
            
            pdfParser.on('pdfParser_dataReady', (pdfData) => {
                try {
                    let fullText = ''
                    pdfData.Pages.forEach((page: any) => {
                        page.Texts.forEach((text: any) => {
                            fullText += decodeURIComponent(text.R[0].T) + ' '
                        })
                    })
                    resolve(fullText.trim())
                } catch (error) {
                    reject(new Error(`Error extracting text from PDF: ${error}`))
                }
            })
            
            pdfParser.parseBuffer(buffer)
        })
    }

    getSupportedTypes(): string[] {
        return ['pdf', 'application/pdf']
    }
}

export class DOCXProcessor implements IDocumentProcessor {
    canProcess(fileType: string): boolean {
        return fileType.toLowerCase() === 'docx' || 
               fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }

    async extractText(buffer: Buffer): Promise<string> {
        try {
            const result = await mammoth.extractRawText({ buffer })
            return result.value
        } catch (error) {
            throw new Error(`Error extracting text from DOCX: ${error}`)
        }
    }

    getSupportedTypes(): string[] {
        return ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    }
}

export class TXTProcessor implements IDocumentProcessor {
    canProcess(fileType: string): boolean {
        return fileType.toLowerCase() === 'txt' || fileType === 'text/plain'
    }

    async extractText(buffer: Buffer): Promise<string> {
        try {
            return buffer.toString('utf-8')
        } catch (error) {
            throw new Error(`Error extracting text from TXT: ${error}`)
        }
    }

    getSupportedTypes(): string[] {
        return ['txt', 'text/plain']
    }
}

export class DefaultProcessor implements IDocumentProcessor {
    canProcess(fileType: string): boolean {
        return true // Fallback processor
    }

    async extractText(buffer: Buffer): Promise<string> {
        try {
            // Try to decode as UTF-8 text
            return buffer.toString('utf-8')
        } catch (error) {
            throw new Error(`Unsupported file type: Unable to extract text.`)
        }
    }

    getSupportedTypes(): string[] {
        return ['*']
    }
}