# 🤖 Chatbot with RAG - Serverless Architecture

## 📋 Overview
A serverless chatbot with Retrieval-Augmented Generation (RAG) capabilities, featuring document processing, vector search, and AI-powered conversations.

### 🏗️ **Architecture**
```
Frontend (React + Vite) 
    ↓
API Gateway 
    ↓
Lambda Functions (Node.js)
    ↓ ↓ ↓
DynamoDB + S3 + Pinecone + Amazon Bedrock
```

### ⚡ **Key Features**
- **📎 Document Upload**: PDF, DOCX, TXT file processing
- **🔍 Vector Search**: Pinecone integration for semantic search  
- **🤖 AI Chat**: Claude 3 Sonnet via Amazon Bedrock
- **🚀 Serverless**: AWS Lambda + API Gateway
- **💾 Data Storage**: DynamoDB metadata + S3 files + Pinecone vectors
- **🛡️ Authentication**: JWT-based user management

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+**
- **AWS CLI** configured with credentials
- **AWS CDK** installed globally: `npm install -g aws-cdk`
- **Pinecone account** (free tier available)

### 1️⃣ Install Dependencies
```bash
# Windows
.\\install-deps.ps1

# Linux/Mac  
./install-deps.sh
```

### 2️⃣ Configure Environment
Update **backend/.env** with your API keys and secrets.

### 3️⃣ Deploy Infrastructure
```bash
cd infrastructure
npm run build
cdk bootstrap  # First time only
npm run deploy
```

### 4️⃣ Create Pinecone Index
Create index `chatbot-document-embeddings` with dimension `1536` and cosine metric.

For detailed setup instructions, see individual README files in each directory.

---

## 📁 Project Structure

- **frontend/**: React + Vite UI
- **backend/**: Business logic services  
- **lambda-handlers/**: AWS Lambda functions
- **infrastructure/**: CDK deployment code

---

## 🔧 Key Changes from Original

✅ **PostgreSQL → DynamoDB**: Serverless metadata storage  
✅ **pgvector → Pinecone**: Specialized vector search  
✅ **Express → Lambda**: Serverless functions  
✅ **Manual deploy → CDK**: Infrastructure as Code  

The application now runs entirely serverless on AWS with Pinecone for vector search!

Full-stack AI chat application with AWS Bedrock integration and S3 file upload.

## Tech Stack

### Backend
- Node.js + Express + TypeScript
- AWS Bedrock (Claude AI)
- AWS S3 (File Storage)
- AWS DynamoDB (Chat History)
- PostgreSQL + pgvector (Vector Search)

### Frontend
- React + TypeScript + Vite
- Tailwind CSS
- React Router
- Axios

## Quick Start

### Prerequisites
- Node.js 18+
- AWS Account with Bedrock access
- PostgreSQL with pgvector extension

### Backend
```bash
npm run install:all
```

### Install dependency for for project
```
npm run install:all
```

### Build Frontend & Backend
```
npm run build:frontend
npm run build:backend
```

### Start Backend
```
npm start:backend
```


## Features
- AI chat with AWS Bedrock
- File upload to S3
- User authentication
- Chat history with DynamoDB
- Vector search with PostgreSQL