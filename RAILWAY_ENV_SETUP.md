# 🔧 Railway Environment Variables Setup

## 🚨 WICHTIG: Diese Variablen MÜSSEN in Railway gesetzt werden!

### 1. Gehe zu Railway Dashboard
- Öffne dein Projekt
- Klicke auf deinen Service
- Gehe zu "Variables" Tab

### 2. Setze diese PFLICHT-Variablen:

```bash
# Produktions-Einstellungen
NODE_ENV=production
PORT=3001

# Supabase Konfiguration
SUPABASE_URL=https://kong-production-9e43.up.railway.app
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dein-echter-key-hier

# Security
WEBHOOK_SECRET=auto-alert-webhook-secret-2024

# Frontend URL
FRONTEND_URL=https://auto-alert.vercel.app
```

### 3. Optional aber empfohlen:

```bash
# Voice Calls (Retell AI)
RETELL_API_KEY=key_dein-retell-key-hier
RETELL_AGENT_ID=agent-id-here
RETELL_PHONE_NUMBER=+1234567890

# Email Service (Resend)
RESEND_API_KEY=re_dein-resend-key-hier

# Test API (automatisch generiert wenn nicht gesetzt)
TEST_API_KEY=dein-test-key-hier
```

## 🔍 Wichtige Keys finden:

### Supabase Service Role Key:
1. Gehe zu deinem Supabase Projekt
2. Settings → API
3. Kopiere den "service_role" Key (nicht anon!)

### Retell AI Key:
1. Gehe zu Retell AI Dashboard
2. API Keys → Create New Key

### Resend API Key:
1. Gehe zu Resend Dashboard
2. API Keys → Create API Key

## ✅ Validierung:

Nach dem Setzen der Variablen sollte Railway automatisch neu deployen.

**Successful Deployment Logs:**
```
✅ Environment validation passed
📋 Service Configuration:
   Environment: production
   Port: 3001
   Supabase: ✅ Connected
   Voice Calls: ✅ Enabled (wenn RETELL_API_KEY gesetzt)
   Email: ✅ Enabled (wenn RESEND_API_KEY gesetzt)
🚀 Auto-Alert Notification Service Started
📡 Server listening on http://0.0.0.0:3001
```

## 🚨 Fehlerbehebung:

### ❌ "Missing required environment variables"
- Prüfe ob alle PFLICHT-Variablen gesetzt sind
- Railway Variables Tab öffnen und prüfen

### ❌ "Invalid format for SUPABASE_SERVICE_ROLE_KEY"
- Muss ein gültiger JWT Token sein (beginnt mit eyJ)
- Aus Supabase Settings → API kopieren

### ❌ Server startet aber crashes sofort
- Logs in Railway anschauen
- Meist Datenbankverbindung oder Port-Probleme

---

**Nach erfolgreicher Konfiguration sollte der Service starten! 🚀**