# GenAI Project

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