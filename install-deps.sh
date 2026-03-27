#!/bin/bash

# Script to install all dependencies for the Chatbot project

echo "🚀 Installing dependencies for Chatbot project..."

echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

echo "🏗️ Installing infrastructure dependencies..."
cd infrastructure  
npm install
cd ..

echo "⚡ Installing lambda-handlers dependencies..."
cd lambda-handlers
npm install
cd ..

echo "🎨 Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo "✅ All dependencies installed successfully!"
echo ""
echo "🔧 Next steps:"
echo "1. Configure your environment variables (see backend/.env)"
echo "2. Set up your AWS credentials"
echo "3. Create a Pinecone account and get API key"
echo "4. Deploy infrastructure: cd infrastructure && npm run deploy"



