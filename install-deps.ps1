# Script to install all dependencies for the Chatbot project

Write-Host "🚀 Installing dependencies for Chatbot project..." -ForegroundColor Green

Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
Set-Location backend
npm install
Set-Location ..

Write-Host "🏗️ Installing infrastructure dependencies..." -ForegroundColor Yellow
Set-Location infrastructure
npm install
Set-Location ..

Write-Host "⚡ Installing lambda-handlers dependencies..." -ForegroundColor Yellow
Set-Location lambda-handlers
npm install
Set-Location ..

Write-Host "🎨 Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location frontend
npm install
Set-Location ..

Write-Host "✅ All dependencies installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🔧 Next steps:" -ForegroundColor Cyan
Write-Host "1. Configure your environment variables (see backend/.env)" -ForegroundColor White
Write-Host "2. Set up your AWS credentials" -ForegroundColor White  
Write-Host "3. Create a Pinecone account and get API key" -ForegroundColor White
Write-Host "4. Deploy infrastructure: cd infrastructure && npm run deploy" -ForegroundColor White