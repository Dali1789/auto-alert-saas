# 🚂 Railway Environment Variables - SETUP GUIDE

## 🚨 SOFORTIGE AKTION ERFORDERLICH

Der Server ist **bereit für Deployment**, aber Railway braucht diese Environment Variables:

## ✅ **MANDATORY Environment Variables:**

```bash
NODE_ENV=production
PORT=3001
WEBHOOK_SECRET=auto-alert-webhook-secret-2024
```

## 🔑 **Database Configuration (KRITISCH):**

```bash
# Deine echten Supabase Credentials hier einfügen:
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📧 **API Keys (Optional aber empfohlen):**

```bash
# Retell AI für Voice Calls:
RETELL_API_KEY=key_your-retell-key

# Resend für Emails:
RESEND_API_KEY=re_your-resend-key
```

## 🌐 **Frontend URL:**

```bash
FRONTEND_URL=https://auto-alert.vercel.app
```

---

## 🚀 **DEPLOYMENT COMMAND:**

**Da Railway CLI Login nicht funktioniert, bitte manuell ausführen:**

### **SCHRITT 1: Railway Dashboard öffnen**
```bash
# Browser öffnen:
https://railway.app/dashboard
```

### **SCHRITT 2: Service erstellen/updaten**
1. **Neuer Service:** "Deploy from GitHub" → `auto-alert-saas`
2. **Service Settings:**
   - **Name:** `auto-alert-notifications`
   - **Start Command:** `npm start`
   - **Port:** `3001`

### **SCHRITT 3: Environment Variables setzen**
Alle Variables aus diesem File im Railway Dashboard hinzufügen.

### **SCHRITT 4: Deploy starten**
Railway startet automatisch nach Environment Variable Updates.

---

## ✅ **DEPLOYMENT STATUS CHECK:**

Nach dem Deployment testen:

```bash
# Health Check:
curl https://your-service.railway.app/health

# Expected Response:
{
  "status": "healthy",
  "service": "Auto-Alert Notification Service"
}
```

---

## 🆘 **TROUBLESHOOTING:**

**❌ "Missing environment variables"**
→ Alle MANDATORY Variables im Railway Dashboard setzen

**❌ "Database connection failed"**  
→ SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY prüfen

**❌ "Server won't start"**
→ Railway Logs checken: Service → Deployments → View Logs

---

**Status:** 🟢 **DEPLOYMENT READY** - Nur Environment Variables fehlen noch!