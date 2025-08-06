# Deployment Security Checklist

## Pre-Deployment Security Checklist

### 🔐 Environment Variables & Secrets
- [ ] **WEBHOOK_SECRET**: Generated and set (minimum 32 characters)
- [ ] **TEST_API_KEY**: Generated for development/testing endpoints
- [ ] **SERVICE_API_KEY**: Generated for internal service communication
- [ ] **SUPABASE_SERVICE_ROLE_KEY**: Validated format and permissions
- [ ] **RETELL_API_KEY**: Validated and active
- [ ] **RESEND_API_KEY**: Validated and has sending quota
- [ ] All secrets stored in Railway environment variables (not in code)
- [ ] No hardcoded credentials in codebase

### 🛡️ Security Configurations
- [ ] Rate limiting enabled and configured appropriately
- [ ] Security headers (HSTS, CSP, XSS Protection) configured
- [ ] CORS configured with specific allowed origins
- [ ] CSRF protection enabled
- [ ] Input validation implemented for all endpoints
- [ ] Error messages sanitized (no sensitive data exposure)

### 🔒 Authentication & Authorization
- [ ] Webhook signature verification implemented
- [ ] API key authentication for test endpoints
- [ ] Test endpoints disabled in production
- [ ] Database RLS (Row Level Security) policies enabled
- [ ] Supabase JWT validation working

### 🗄️ Database Security
- [ ] Database connection encrypted (SSL/TLS)
- [ ] Service role permissions minimized
- [ ] Sensitive data encrypted at rest
- [ ] Database backups secured
- [ ] Connection pooling properly configured

### 📊 Monitoring & Logging
- [ ] Error tracking configured (Sentry)
- [ ] Security event logging enabled
- [ ] Performance monitoring active
- [ ] Rate limiting logs monitored
- [ ] Failed authentication attempts tracked

## Deployment Commands

### 1. Generate Required Secrets
```bash
# Generate webhook secret (32+ characters)
node -e "console.log('WEBHOOK_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate test API key
node -e "console.log('TEST_API_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate service API key
node -e "console.log('SERVICE_API_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Set Railway Environment Variables
```bash
# Set in Railway dashboard or via CLI
railway variables set WEBHOOK_SECRET=your-generated-secret
railway variables set TEST_API_KEY=your-test-key
railway variables set SERVICE_API_KEY=your-service-key
railway variables set NODE_ENV=production
```

### 3. Deploy Application
```bash
# Install dependencies with security updates
npm audit fix --force

# Run security tests
npm test

# Deploy to Railway
railway deploy
```

## Post-Deployment Verification

### 🧪 Security Testing
```bash
# Test webhook security (should fail without signature)
curl -X POST https://your-app.railway.app/api/webhooks/n8n \
  -H "Content-Type: application/json" \
  -d '{"searchId":"test","newVehicles":[]}'
# Expected: 401 Unauthorized

# Test test endpoint in production (should be disabled)
curl -X POST https://your-app.railway.app/api/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{"testEmail":"test@example.com"}'
# Expected: 404 Not Found

# Test rate limiting
for i in {1..200}; do curl https://your-app.railway.app/health; done
# Expected: Some 429 responses

# Test security headers
curl -I https://your-app.railway.app/health
# Expected: Security headers present
```

### 📊 Health Checks
```bash
# Basic health check
curl https://your-app.railway.app/health

# Detailed health check
curl https://your-app.railway.app/health/detailed

# Readiness check
curl https://your-app.railway.app/health/ready
```

### 🔍 Log Verification
- [ ] Check Railway logs for startup messages
- [ ] Verify no sensitive data in logs
- [ ] Confirm security middleware is active
- [ ] Check error handling is working

## Security Monitoring Setup

### 1. Set up Alerts
```javascript
// Example webhook for security alerts
POST /api/webhooks/security-alert
{
  "event": "rate_limit_exceeded",
  "ip": "192.168.1.1",
  "endpoint": "/api/webhooks/n8n",
  "timestamp": "2024-08-06T10:30:00Z"
}
```

### 2. Monitor Key Metrics
- Failed authentication attempts per hour
- Rate limiting triggers per hour
- Invalid webhook signatures per day
- Error rates by endpoint
- Response time anomalies

### 3. Automated Security Checks
```bash
# Add to CI/CD pipeline
npm run security-audit
npm run test:security
npm run validate-env
```

## Incident Response Plan

### 🚨 Security Incident Response
1. **Detection**: Monitor logs and alerts
2. **Assessment**: Determine severity and impact
3. **Containment**: Block malicious IPs, disable compromised keys
4. **Recovery**: Restore service with security patches
5. **Post-Incident**: Review and improve security measures

### 🔄 Key Rotation Procedures
```bash
# Rotate webhook secret
1. Generate new secret
2. Update environment variables
3. Deploy new version
4. Update external services (n8n, etc.)
5. Verify functionality
6. Invalidate old secret
```

## Compliance & Auditing

### 📋 Regular Security Tasks
- [ ] **Weekly**: Review security logs and failed attempts
- [ ] **Monthly**: Update dependencies and security patches
- [ ] **Quarterly**: Full security audit and penetration testing
- [ ] **Annually**: Complete security architecture review

### 📝 Documentation
- [ ] Security architecture documented
- [ ] Incident response procedures documented
- [ ] Key rotation procedures documented
- [ ] Compliance requirements mapped

## Emergency Contacts

- **Security Team**: security@autoalert.com
- **DevOps Team**: devops@autoalert.com
- **On-Call Engineer**: +49-xxx-xxx-xxxx

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)

---

**Last Updated**: August 6, 2025  
**Version**: 1.0  
**Next Review**: September 6, 2025