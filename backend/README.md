# GenAI - AI Chat Assistant với RAG

Ứng dụng AI Chat Assistant sử dụng AWS Bedrock Claude và Vector Database để trả lời câu hỏi dựa trên ngữ cảnh từ tài liệu.

## Tính năng

- 🤖 Chat với AI Assistant sử dụng AWS Bedrock Claude
- 📄 Upload và xử lý tài liệu (PDF, DOCX)
- 🔍 Tìm kiếm ngữ cảnh với Vector Embeddings
- 🔐 Xác thực người dùng với JWT
- 📊 API Documentation với Swagger
- 🗄️ Lưu trữ vector trong PostgreSQL

## Công nghệ sử dụng

- **Backend**: Node.js, Express.js, TypeScript
- **AI/ML**: AWS Bedrock (Claude), LangChain
- **Database**: PostgreSQL với pgvector
- **Storage**: AWS S3, DynamoDB
- **Authentication**: JWT, bcryptjs

## Cài đặt

### Yêu cầu hệ thống
- Node.js >= 16
- PostgreSQL với extension pgvector
- AWS Account với quyền truy cập Bedrock, S3, DynamoDB

### Cài đặt dependencies
```bash
npm install
```

### Cấu hình môi trường
Tạo file `.env` với các biến sau:
```env
# Server
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=genai
DB_USER=your_username
DB_PASSWORD=your_password
VECTOR_TABLE=document_embeddings

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Bedrock
GENARATE_MODELID=anthropic.claude-3-sonnet-20240229-v1:0
EMBEDDING_MODELID=amazon.titan-embed-text-v1
AUTHROPIC_VERSION=bedrock-2023-05-31
MAX_TOKEN=4000
TEMPERATURE=0.7
TOP_P=0.9
TOP_K=250
ROLE=user

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# S3
S3_BUCKET_NAME=your_bucket_name
```

### Thiết lập Database
```sql
-- Tạo extension pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Chạy schema từ src/dbs/schema.sql
```

## Chạy ứng dụng

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Đăng ký tài khoản
- `POST /api/v1/auth/login` - Đăng nhập
- `POST /api/v1/auth/logout` - Đăng xuất

### Chat
- `POST /api/v1/chat` - Chat với AI Assistant

### Document Management
- `POST /api/v1/s3/upload` - Upload tài liệu
- `POST /api/v1/s3/upload-url` - Lấy ra 1 url
- `GET /api/v1/s3/list-object` - Get ra tất cả object
- `GET /api/v1/s3/uploads/:key` - Get 1 file tài liệu

### Embeding Document
- `POST /apiv1/embedding/process` - Xử lý và tạo embeddings

### API Documentation
Truy cập Swagger UI tại: `http://localhost:3000/api-docs`

## Cấu trúc dự án

```
src/
├── config/          # Cấu hình ứng dụng
├── controllers/     # Controllers xử lý request
├── middleware/      # Middleware xác thực
├── models/          # Data models
├── providers/       # Kết nối AWS services
├── routes/          # API routes
├── services/        # Business logic
└── utils/           # Utilities
```

## Workflow

1. **Upload tài liệu** → S3 Storage
2. **Xử lý tài liệu** → Extract text, tạo chunks
3. **Tạo embeddings** → AWS Bedrock Titan
4. **Lưu trữ vectors** → PostgreSQL
5. **Chat query** → Tìm kiếm similar chunks → Generate response với Claude

## License

ISC