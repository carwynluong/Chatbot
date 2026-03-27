#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { ChatbotStack } from './lib/chatbot-stack'

const app = new cdk.App()

const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
}

new ChatbotStack(app, 'ChatbotStack', {
    env,
    description: 'Serverless Chatbot with RAG using Lambda, DynamoDB, and Pinecone'
})