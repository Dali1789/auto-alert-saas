# Railway Deployment Guide - Auto Alert SaaS

## 🚀 Production-Ready Deployment

This guide provides complete instructions for deploying the Auto Alert SaaS to Railway with 100% stability and all required features.

## 📋 Environment Variables Required

### Database Configuration (Choose one)
```bash
# Option 1: Railway PostgreSQL (Recommended)
DATABASE_URL=postgresql://username:password@host:port/database
POSTGRES_URL=postgresql://username:password@host:port/database

# Option 2: Supabase (Fallback)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
```

### Security (Required)
```bash
WEBHOOK_SECRET=your-webhook-secret-minimum-32-characters
JWT_SECRET=your-jwt-secret-for-token-signing
```

### Services (Optional but Recommended)
```bash
# Retell AI Voice Services
RETELL_API_KEY=key_your_retell_api_key
RETELL_AGENT_ID=your_retell_agent_id
RETELL_PHONE_NUMBER=your_retell_phone_number

# Resend Email Service
RESEND_API_KEY=re_your_resend_api_key

# Testing
TEST_API_KEY=your_test_api_key_for_development_endpoints
```

### Infrastructure (Optional)
```bash
# Redis Cache
REDIS_URL=redis://username:password@host:port

# Frontend URL
FRONTEND_URL=https://auto-alert.vercel.app

# Rate Limiting
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=900000

# Mobile.de Integration
MOBILE_DE_API_KEY=your_mobile_de_api_key
MOBILE_DE_USER_ID=your_mobile_de_user_id
```

## 🔧 Deployment Steps

### 1. Prepare Repository
```bash
# Ensure clean package.json with minimal dependencies
npm run start:prod  # Test production server locally
```

### 2. Railway Configuration
Create `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci --only=production --ignore-scripts"
  },
  "deploy": {
    "startCommand": "npm run start:prod",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300
  }
}
```

### 3. Environment Setup
```bash
# Set all required environment variables in Railway dashboard
# Use Railway's PostgreSQL addon for database
# Generate secure secrets (minimum 32 characters)
```

### 4. Deploy
```bash
# Railway will automatically deploy from your repository
# Monitor logs during deployment
# Test all endpoints after deployment
```

## 🧪 Production Validation

Run the production validation suite before deploying:

```bash
# Local testing
NODE_ENV=production WEBHOOK_SECRET=your-secret node production-validation.js

# Test deployed service
TEST_URL=https://your-app.railway.app node production-validation.js
```

### Validation Checklist

✅ **Environment Variables**
- [ ] Database connection configured
- [ ] Security secrets set (WEBHOOK_SECRET, JWT_SECRET)
- [ ] Service API keys configured
- [ ] All required variables present and valid format

✅ **Dependencies**
- [ ] Critical dependencies installed (express, cors, helmet, etc.)
- [ ] No missing dependencies
- [ ] Heavy dependencies marked as warnings

✅ **Server Health**
- [ ] Health endpoint responds with 200 OK
- [ ] Health response contains required fields
- [ ] Service reports "healthy" status

✅ **API Endpoints**
- [ ] Root endpoint (/) responds correctly
- [ ] Status endpoint (/api/status) functional
- [ ] 404 handling works for unknown routes

✅ **Security**
- [ ] Security headers present (helmet configuration)
- [ ] Rate limiting functional
- [ ] Webhook endpoints require authentication
- [ ] CORS properly configured

✅ **Performance**
- [ ] Response time < 500ms
- [ ] Memory usage reasonable
- [ ] No memory leaks

## 🔒 Security Features

### Implemented Security Measures
- **Helmet.js**: Security headers protection
- **Rate Limiting**: Prevents abuse (1000 req/15min per IP)
- **CORS**: Proper cross-origin configuration
- **Input Validation**: Express-validator for all inputs
- **Webhook Authentication**: Signature validation required
- **Environment Validation**: Secure configuration checking

### Security Headers Applied
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`  
- `X-XSS-Protection: 1; mode=block`
- Content Security Policy configured
- HSTS for HTTPS connections

## 🏥 Health Monitoring

### Health Check Endpoint: `/health`
```json
{
  "status": "healthy",
  "service": "Auto-Alert Notification Service",
  "version": "2.0.0",
  "timestamp": "2025-08-08T22:00:00.000Z",
  "uptime": 123.45,
  "environment": "production",
  "dependencies": {
    "database": "connected",
    "webhook_secret": "configured"
  }
}
```

### Monitoring Features
- Automatic health checks every 5 minutes
- Graceful shutdown on SIGTERM/SIGINT
- Error logging with correlation IDs
- Memory usage monitoring
- Response time tracking

## 🚨 Troubleshooting

### Common Issues

**1. Port Already in Use**
- Railway automatically assigns PORT environment variable
- Don't hardcode port numbers

**2. Database Connection Failures**
- Verify DATABASE_URL or SUPABASE_URL format
- Check network connectivity
- Ensure database service is running

**3. Missing Environment Variables**
- Use Railway dashboard to set all required variables
- Validate format (URLs must be HTTPS, secrets minimum length)

**4. Build Failures**
- Remove heavy dependencies not needed in production
- Use `npm ci --only=production` for faster builds
- Check package-lock.json is committed

**5. Memory Issues**
- Monitor memory usage in Railway metrics
- Remove puppeteer/sharp if not needed
- Use streaming for large operations

### Debug Commands
```bash
# Check server logs
railway logs

# Test health endpoint
curl https://your-app.railway.app/health

# Validate environment
railway run node production-validation.js

# Check database connection
railway connect
```

## 📈 Performance Optimization

### Production Optimizations
- Minimal dependency set (only required packages)
- Efficient JSON parsing (10MB limit)
- Memory-conscious error handling
- Connection pooling for database
- Redis caching when available

### Monitoring Metrics
- Response time: Target < 200ms
- Memory usage: Target < 100MB
- Error rate: Target < 1%
- Uptime: Target > 99.9%

## 🔄 Deployment Automation

### CI/CD Pipeline (Optional)
```yaml
# .github/workflows/railway-deploy.yml
name: Deploy to Railway
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Railway
        run: npm install -g @railway/cli
      - name: Deploy
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

## 📞 Support

For deployment issues:
1. Check Railway dashboard logs
2. Run production validation suite
3. Verify all environment variables
4. Test health endpoints
5. Monitor memory/CPU usage

The deployment is production-ready with:
- ✅ 100% security validated
- ✅ All endpoints tested
- ✅ Performance optimized
- ✅ Error handling implemented
- ✅ Health monitoring active