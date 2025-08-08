@echo off
REM Auto Alert SaaS - Complete Deployment Script
REM Run this script to deploy the entire application

echo.
echo ========================================
echo 🚀 AUTO ALERT SAAS - DEPLOYMENT SCRIPT
echo ========================================
echo.

REM Check if Railway CLI is installed
railway --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Railway CLI not found. Installing...
    npm install -g @railway/cli
    echo ✅ Railway CLI installed
)

echo 📋 DEPLOYMENT STEPS:
echo.
echo 1️⃣  Railway Login (opens browser)
echo 2️⃣  Initialize project
echo 3️⃣  Add PostgreSQL database
echo 4️⃣  Set environment variables
echo 5️⃣  Deploy backend
echo 6️⃣  Deploy frontend
echo.

pause

echo.
echo 1️⃣  Logging into Railway...
railway login

echo.
echo 2️⃣  Initializing Railway project...
railway init

echo.
echo 3️⃣  Adding PostgreSQL database...
railway add postgresql

echo.
echo 4️⃣  Setting environment variables...
railway variables set NODE_ENV=production
railway variables set WEBHOOK_SECRET="3d0df94dec152b40a0a39d2be2881b0b8775e4f319fe8e6f5da193cd05a0733a"
railway variables set JWT_SECRET="1a0a0e770c93c01c8938eb1ef2c079c91c458d80fe3d00d6e247a34289669c97"
railway variables set FRONTEND_URL="https://auto-alert.vercel.app"

echo.
echo 5️⃣  Deploying backend to Railway...
railway up

echo.
echo 6️⃣  Installing Vercel CLI for frontend deployment...
npm install -g vercel

echo.
echo 🎯 BACKEND DEPLOYED! Now deploying frontend...
echo.
echo To deploy frontend, run:
echo   cd ..\auto-alert-frontend
echo   vercel --prod
echo.

echo ✅ DEPLOYMENT COMPLETE!
echo.
echo 📊 CHECK YOUR DEPLOYMENT:
echo   Backend:  https://your-app.railway.app/health
echo   Frontend: https://auto-alert.vercel.app
echo.
echo 📋 Next steps:
echo   1. Test health endpoint
echo   2. Configure custom domain (optional)
echo   3. Add email/voice services (optional)
echo.

pause