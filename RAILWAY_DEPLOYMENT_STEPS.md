# 🚂 Railway Deployment - Step by Step Guide

## 📋 Pre-Deployment Checklist

### 1. First, commit and push your changes to GitHub:

```bash
cd auto-alert-saas

# Add all necessary files
git add railway.json
git add package.json
git add railway/notification-service/
git add scripts/

# Commit changes
git commit -m "feat: Prepare Railway deployment configuration"

# Push to GitHub
git push origin main
```

### 2. Railway Dashboard Deployment

1. **Open Railway Dashboard**: https://railway.app/dashboard

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Authorize Railway to access your GitHub (if not already done)
   - Search for: `auto-alert-saas`
   - Select the repository

3. **Configure the Service**:
   - **Service Name**: `auto-alert-notifications`
   - **Environment**: Production
   - **Branch**: main

4. **Set Environment Variables**:
   Click on the service, then go to "Variables" tab and add:

   ```
   NODE_ENV=production
   PORT=3001
   SUPABASE_URL=https://kong-production-9e43.up.railway.app
   SUPABASE_SERVICE_ROLE_KEY=[YOUR_KEY]
   RETELL_API_KEY=[YOUR_KEY]
   RESEND_API_KEY=[YOUR_KEY]
   WEBHOOK_SECRET=auto-alert-webhook-secret-2024
   FRONTEND_URL=https://auto-alert.vercel.app
   ```

5. **Configure Settings**:
   - Go to "Settings" tab
   - Under "Deploy"
     - Root Directory: `/` (leave empty)
     - Build Command: `npm install`
     - Start Command: `npm start`
   
6. **Enable Public Networking**:
   - Go to "Settings" → "Networking"
   - Click "Generate Domain"
   - Note your domain (e.g., `auto-alert-notifications.up.railway.app`)

### 3. Monitor Deployment

1. **Watch Build Logs**:
   - Click on "Deployments" tab
   - Click on the current deployment
   - Monitor the build process

2. **Check for Errors**:
   - Look for any red error messages
   - Common issues: missing dependencies, port conflicts

### 4. Post-Deployment Validation

Once deployed, test your service:

```bash
# Replace with your actual Railway domain
RAILWAY_URL=https://auto-alert-notifications.up.railway.app

# Test health endpoint
curl $RAILWAY_URL/health

# Test detailed health
curl $RAILWAY_URL/health/detailed
```

### 5. Database Setup (if not done)

If database tables are missing, run this in Railway's PostgreSQL query editor:

1. Go to your Railway project
2. Click on the PostgreSQL service
3. Go to "Query" tab
4. Run the SQL from `railway/setup-database.sql`

### 6. Connect n8n Workflow

1. Import workflow: `railway/n8n-workflows/mobile-de-scraper-production.json`
2. Update webhook URL to your Railway service
3. Add Railway credentials to n8n

## 🚨 Troubleshooting

### Build Fails
- Check package.json syntax
- Verify all dependencies are listed
- Check Node version compatibility

### Service Crashes
- Check environment variables
- Review logs for missing configs
- Verify database connection

### Health Check Fails
- Ensure PORT is set correctly
- Check CORS configuration
- Verify all services are running

## ✅ Success Indicators

- Build completes without errors
- Health check returns 200 OK
- All services show "healthy" in detailed health
- Webhook test returns success

---

**Need help?** Check the Railway logs or create an issue in the GitHub repository.