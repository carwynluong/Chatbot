# Chatbot Infrastructure

## Overview
This CDK project deploys a serverless chatbot with RAG (Retrieval-Augmented Generation) capabilities using AWS Lambda, DynamoDB, S3, and Pinecone vector database.

## Architecture
- **API Gateway**: REST API endpoints
- **Lambda Functions**: 
  - Auth function (register, login, refresh, logout)
  - Upload function (S3 file upload and management)
  - Embedding function (document processing and Pinecone vectorization)
  - Chat function (RAG-powered conversations)
- **DynamoDB Tables**:
  - Users table with email index
  - Documents metadata table with status index  
  - Chat history table
- **S3 Bucket**: Document storage
- **Pinecone**: Vector database for embeddings (external service)

## Prerequisites
1. AWS CLI configured with appropriate credentials
2. AWS CDK installed (`npm install -g aws-cdk`)
3. Node.js 18+
4. Pinecone account and API key

## Environment Variables
Set these environment variables before deployment:
```bash
export PINECONE_API_KEY="your-pinecone-api-key"
export PINECONE_INDEX_NAME="chatbot-document-embeddings" 
export PINECONE_ENVIRONMENT="gcp-starter"
export JWT_SECRET="your-strong-jwt-secret"
export REFRESH_TOKEN_SECRET="your-strong-refresh-secret"
```

## Deployment

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Bootstrap CDK (first time only):
```bash
cdk bootstrap
```

4. Deploy the stack:
```bash 
npm run deploy
```

## Useful Commands
- `npm run build` - compile TypeScript to JS
- `npm run watch` - watch for changes and compile
- `npm run test` - perform the jest unit tests  
- `npm run deploy` - deploy this stack to your default AWS account/region
- `cdk diff` - compare deployed stack with current state
- `cdk synth` - emits the synthesized CloudFormation template
- `npm run destroy` - destroy the stack

## Outputs
After deployment, you'll get:
- API Gateway URL
- S3 Bucket name
- DynamoDB table names

## Notes
- The Lambda functions include a 15-minute timeout for embedding processing
- CORS is configured for all origins (adjust for production)
- DynamoDB tables use PAY_PER_REQUEST billing
- S3 bucket has versioning enabled
- All resources have RETAIN removal policy for safety