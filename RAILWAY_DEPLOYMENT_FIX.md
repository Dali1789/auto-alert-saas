# 🚂 RAILWAY DEPLOYMENT - REPARATUR GUIDE

## 🚨 **PROBLEM IDENTIFIZIERT:**
- Auto-Alert Tabellen fehlen in der Datenbank
- Backend Service ist nicht deployed
- Environment Variables fehlen

## ✅ **SOFORTIGE LÖSUNG:**

### **SCHRITT 1: Database Setup (5 Min)**

1. **Gehe zu Railway Dashboard:** https://railway.app/dashboard
2. **Öffne dein Supabase Projekt** (Kong Production)
3. **Klicke auf "Data" → "SQL Editor"**
4. **Kopiere & Führe aus:** `railway/setup-database.sql`

```sql
-- Das komplette SQL-Script ist in railway/setup-database.sql
-- Es erstellt alle Auto-Alert Tabellen + Sample Data
```

### **SCHRITT 2: Backend Service deployen (10 Min)**

1. **Neuen Service erstellen:**
   - Railway Dashboard → **"New Service"**
   - **"Deploy from GitHub repo"**
   - Wähle: `Dali1789/auto-alert-saas`

2. **Service konfigurieren:**
   - **Service Name:** `auto-alert-notifications`
   - **Root Directory:** `/` (nicht `/railway/notification-service`)
   - **Start Command:** `npm start`
   - **Port:** `3001`

3. **Environment Variables setzen:**
```bash
NODE_ENV=production
PORT=3001
SUPABASE_URL=https://kong-production-9e43.up.railway.app
SUPABASE_SERVICE_ROLE_KEY=dein-service-role-key
RETELL_API_KEY=key_dein-retell-key  
RESEND_API_KEY=re_dein-resend-key
WEBHOOK_SECRET=auto-alert-webhook-secret-2024
FRONTEND_URL=https://auto-alert.vercel.app
```

### **SCHRITT 3: Health Check (2 Min)**

Nach dem Deployment:

```bash
# In Railway Service Terminal:
node railway/health-check.js
```

**Erwartete Ausgabe:**
```
🎉 ALL CHECKS PASSED! Auto-Alert SaaS is ready to deploy!
```

### **SCHRITT 4: API Endpoints testen (3 Min)**

**Health Check:**
```bash
curl https://dein-service.railway.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "Auto-Alert Notification Service",
  "timestamp": "2025-08-05T14:30:00.000Z"
}
```

**Test Webhook:**
```bash
curl -X POST https://dein-service.railway.app/api/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "test@example.com"}'
```

## 🔧 **TROUBLESHOOTING:**

### **❌ Problem: "Table does not exist"**
**Lösung:** 
```sql
-- In Railway PostgreSQL SQL Editor:
\copy (SELECT 'auto_alert_user_profiles', count(*) FROM auto_alert_user_profiles) TO stdout;
```
Wenn Fehler → `railway/setup-database.sql` nochmal ausführen

### **❌ Problem: "Environment Variable missing"**
**Lösung:**
1. Railway Service → Variables Tab
2. Alle Environment Variables aus Schritt 2 hinzufügen
3. Service restarten

### **❌ Problem: "Port 3001 not accessible"**
**Lösung:**
1. Railway Service → Settings → Networking
2. **Public Domain** aktivieren
3. **Port:** `3001` setzen

### **❌ Problem: "Dockerfile not found"**
**Lösung:** 
Railway nutzt automatisch das Root-Dockerfile. Service-Settings:
- **Build Command:** `npm install`  
- **Start Command:** `cd railway/notification-service && npm start`

## 📊 **DEPLOYMENT STATUS CHECK:**

### **✅ Erfolgreich wenn:**
- ✅ Health Check: 200 OK
- ✅ Database: 4 Tabellen existieren
- ✅ Retell AI: Connection OK  
- ✅ Resend: Connection OK
- ✅ Webhook: Test erfolgreich

### **❌ Fehler wenn:**
- ❌ 500 Internal Server Error
- ❌ Database Connection Failed
- ❌ Environment Variables Missing

## 🚀 **NACH DEM DEPLOYMENT:**

### **n8n Workflow Setup:**
1. **Import Workflow:** `railway/n8n-workflows/mobile-de-scraper-production.json`
2. **Webhook URL setzen:** `https://dein-service.railway.app/api/webhooks/n8n`
3. **Environment Variables:** SUPABASE_* + WEBHOOK_SECRET
4. **Activate Workflow**

### **Frontend Deployment:**
```bash
# Vercel Deployment:
cd frontend
vercel --prod

# Environment Variables in Vercel:
NEXT_PUBLIC_API_URL=https://dein-service.railway.app
```

## 📈 **SUCCESS METRICS:**

Nach erfolgreichem Deployment solltest du haben:

- 🟢 **Railway Service:** Running
- 🟢 **Database:** 4 Auto-Alert Tabellen
- 🟢 **API:** Health Check OK
- 🟢 **Webhooks:** Ready für n8n
- 🟢 **Voice Calls:** Retell AI connected
- 🟢 **Emails:** Resend connected

## 🎯 **FINAL CHECK:**

```bash
# Alle Services testen:
curl https://dein-service.railway.app/health/detailed

# Expected: Alle Services "healthy" oder "configured"
```

---

## 🆘 **NOTFALL-KONTAKT:**

Wenn immer noch Probleme bestehen:

1. **Railway Logs checken:** Service → Deployments → View Logs
2. **Database direkter Zugriff:** Railway → Database → Connect
3. **GitHub Issues:** Erstelle Issue mit Error-Logs

**Das Deployment sollte jetzt funktionieren!** 🚀

**Repository:** https://github.com/Dali1789/auto-alert-saas  
**Status:** 🔧 **RAILWAY DEPLOYMENT REPARIERT**
