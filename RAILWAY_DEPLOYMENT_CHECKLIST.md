
# 🚂 Railway Deployment Checklist

## Before Deployment:

- [ ] GitHub repository connected (Dali1789/auto-alert-saas)
- [ ] Railway project created
- [ ] Database setup completed (railway/setup-database.sql)
- [ ] Environment variables configured

## Deployment Steps:

1. **Create New Service in Railway:**
   - Go to Railway Dashboard
   - Click "New Service"
   - Select "Deploy from GitHub repo"
   - Choose: Dali1789/auto-alert-saas

2. **Configure Service:**
   - Service Name: auto-alert-notifications
   - Root Directory: / (leave empty)
   - Start Command: npm start
   - Port: 3001

3. **Set Environment Variables:**
   - Copy all variables from .env.railway
   - Paste in Railway Variables tab

4. **Enable Public Domain:**
   - Go to Settings → Networking
   - Generate Domain
   - Note the URL for testing

## After Deployment:

- [ ] Health check passed (/health endpoint)
- [ ] Database connections verified
- [ ] Retell AI integration tested
- [ ] Resend email service tested
- [ ] Webhook endpoints accessible

## Testing Commands:

```bash
# Health Check
curl https://your-service.railway.app/health

# Test Webhook
curl -X POST https://your-service.railway.app/api/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "test@example.com"}'
```
