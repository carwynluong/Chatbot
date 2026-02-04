import { EmbeddingService } from "./embedding.service"
import { InvokeModelWithResponseStreamCommand } from "@aws-sdk/client-bedrock-runtime"
import {
    AUTHROPIC_VERSION, MAX_TOKEN, ROLE, GENARATE_MODELID,
    TEMPERATURE, TOP_P, TOP_K, VECTOR_TABLE, CHAT_TABLE_NAME
} from "../config/env"
import pool from "../providers/postgresql.connect"
import bedrockClient from "../providers/bedrock.connect"
import { ChatMessage, ChatSession } from "../models/chat.model"
import { dynamoClient } from "../providers/dynamodb.connect"
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"

export class ChatService {
    async *queryWithContext(question: string): AsyncIterable<string> {
        const questionEmbedding = await new EmbeddingService().generateEmbedding(question)

        const similarChunks = await this.findSimilarChunks(questionEmbedding)

        const context = similarChunks.map(chunk => chunk.content).join('\n\n')
        const prompt = this.buildPromt(question, context)

        yield* this.invokeClaudeStream(prompt)

    }

    async saveChatSession(userId: string, messages: ChatMessage[]): Promise<void> {
        const timestamp = Date.now()
        const now = new Date().toISOString()
        const command = {
            TableName: CHAT_TABLE_NAME,
            Item: {
                userId,
                timestamp,
                messages,
                createdAt: now,
                updatedAt: now
            }
        }
        await dynamoClient.send(new PutCommand(command))
    }

    async getChatHistory(userId: string): Promise<ChatSession[]> {
        const command = {
            TableName: CHAT_TABLE_NAME,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        }
        const result = await dynamoClient.send(new QueryCommand(command))
        console.log('Get message', result.Items)
        return result.Items as ChatSession[] || []
    }

    private async findSimilarChunks(queryEmbeding: number[]) {

        const embeddingStr = `[${queryEmbeding.join(',')}]`

        const query = `
            SELECT file_name, chunk_index, content, embedding <-> $1::vector as distance
            FROM ${VECTOR_TABLE}
            ORDER BY embedding <-> $1::vector 
            LIMIT $2;
        `

        const result = await pool.query(query, [embeddingStr, TOP_K])
        return result.rows
    }

    private buildPromt(question: string, context: String): string {
        return `Bạn là một AI assistant thông minh. Hãy trả lời câu hỏi dựa trên thông tin được cung cấp.
            Human: ${question}
            ${context}
            Assistant:
        `
    }

    private async *invokeClaudeStream(promt: string): AsyncIterable<string> {

        const command = new InvokeModelWithResponseStreamCommand({
            modelId: GENARATE_MODELID,
            body: JSON.stringify({
                "anthropic_version": AUTHROPIC_VERSION,
                "max_tokens": parseInt(MAX_TOKEN!),
                "messages": [
                    {
                        "role": ROLE,
                        "content": promt
                    }
                ],
                "temperature": parseFloat(TEMPERATURE!),
                "top_p": parseFloat(TOP_P!),
                "top_k": parseInt(TOP_K!)
            }),
            contentType: 'application/json'
        })

        try {
            const res = await bedrockClient.send(command)

            if (res.body) {
                for await (const chunk of res.body) {
                    if (chunk.chunk?.bytes) {
                        const data = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes))

                        if (data.type === 'content_block_delta' && data.delta?.text) {
                            yield data.delta.text
                        }
                    }
                }
            }
            console.log('Stream completed')
        } catch (error) {
            console.error('Claude stream error:', error)
            yield 'Error occurred while generating response.'
        }
    }
}
