# 🚂 Railway Complete Infrastructure Setup

## 📋 Übersicht
Diese Anleitung erstellt eine **komplett isolierte** Auto-Alert SaaS Infrastruktur in Railway mit:
- ✅ PostgreSQL Datenbank (eigene Instanz)
- ✅ Redis Cache (eigene Instanz) 
- ✅ Backend API Service
- ✅ Alle Services in einem Projekt, isoliert von anderen

## 🚀 Schritt 1: Neues Railway Projekt erstellen

1. **Gehe zu Railway**: https://railway.app/dashboard
2. **Klicke "New Project"**
3. **Wähle "Empty Project"** (nicht Template!)
4. **Benenne es**: "Auto-Alert SaaS Production"

## 🗄️ Schritt 2: PostgreSQL Datenbank deployen

1. **Im neuen Projekt klicke "+ New Service"**
2. **Wähle "Database" → "PostgreSQL"**
3. **Service Name**: `postgresql-autoalert`
4. **Variables werden automatisch gesetzt**:
   - `POSTGRES_DB`: autoalert
   - `POSTGRES_USER`: postgres  
   - `POSTGRES_PASSWORD`: [automatisch generiert]

## 🔄 Schritt 3: Redis Cache deployen

1. **Klicke wieder "+ New Service"**
2. **Wähle "Database" → "Redis"** 
3. **Service Name**: `redis-autoalert`
4. **Variables werden automatisch gesetzt**:
   - `REDIS_PASSWORD`: [automatisch generiert]

## 💻 Schritt 4: Backend API Service deployen

1. **Klicke "+ New Service"**
2. **Wähle "GitHub Repo"**
3. **Wähle Repository**: `Dali1789/auto-alert-saas`
4. **Service Name**: `auto-alert-backend`
5. **Branch**: main

### Environment Variables setzen:

**Service Settings** → **Variables** → **Alle hinzufügen**:

```bash
# Server Konfiguration
NODE_ENV=production
PORT=3001

# PostgreSQL (Internal Railway Connection)
DATABASE_URL=postgresql://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
POSTGRES_URL=${{Postgres.DATABASE_URL}}

# Redis (Internal Railway Connection)  
REDIS_URL=redis://:${{Redis.REDISPASSWORD}}@${{Redis.RAILWAY_PRIVATE_DOMAIN}}:6379

# Required Security
WEBHOOK_SECRET=auto-alert-webhook-secret-railway-2024

# Frontend
FRONTEND_URL=https://auto-alert.vercel.app

# Optional: External Services
RETELL_API_KEY=key_your-retell-key-here
RESEND_API_KEY=re_your-resend-key-here
```

## 🛠️ Schritt 5: Datenbank Schema einrichten

1. **Gehe zu PostgreSQL Service** → **"Data"** → **"Query"**
2. **Kopiere den Inhalt von** `railway-infrastructure/database-setup.sql`
3. **Führe das SQL Script aus**
4. **Verifiziere**: Du solltest 4 Tabellen sehen:
   - `auto_alert_user_profiles`
   - `auto_alert_search_criteria` 
   - `auto_alert_found_vehicles`
   - `auto_alert_notifications`

## 🔗 Schritt 6: Public Domain aktivieren

1. **Gehe zu Backend Service** → **"Settings"** → **"Networking"**
2. **Klicke "Generate Domain"**
3. **Notiere die URL**: z.B. `auto-alert-backend-production.up.railway.app`

## ✅ Schritt 7: Deployment testen

Nach dem Deployment teste die Endpoints:

```bash
# Ersetze mit deiner Railway Domain
RAILWAY_URL=https://auto-alert-backend-production.up.railway.app

# Health Check
curl $RAILWAY_URL/health

# Erwartete Antwort:
{
  "status": "healthy",
  "service": "Auto-Alert Notification Service", 
  "timestamp": "2025-08-06T12:00:00.000Z"
}

# Database Health Check
curl $RAILWAY_URL/health/detailed

# Erwartete Antwort:
{
  "status": "healthy",
  "services": {
    "database": { "status": "healthy" },
    "redis": { "status": "healthy" }
  }
}
```

## 📊 Schritt 8: Services Übersicht

Nach erfolgreichem Setup hast du:

### 🟢 PostgreSQL Service
- **Name**: postgresql-autoalert
- **Port**: 5432 (internal)
- **Database**: autoalert
- **User**: postgres
- **Schemas**: auto_alert mit 4 Tabellen

### 🟢 Redis Service  
- **Name**: redis-autoalert
- **Port**: 6379 (internal)
- **Storage**: In-memory + persistence

### 🟢 Backend Service
- **Name**: auto-alert-backend  
- **Port**: 3001 (public)
- **Domain**: auto-alert-backend-xyz.up.railway.app
- **Health**: /health endpoint

## 🔧 Troubleshooting

### ❌ "Database connection failed"
- Prüfe ob PostgreSQL Service läuft
- Prüfe DATABASE_URL Variable
- Verwende Railway's interne Domain-Namen

### ❌ "Redis connection failed"  
- Prüfe ob Redis Service läuft
- Prüfe REDIS_URL Variable
- Verwende Railway's interne Domain-Namen

### ❌ "Health check fails"
- Prüfe alle Environment Variables
- Schaue in Service Logs
- Teste einzelne Services

## 💰 Kosten Schätzung

**Railway Pricing** (ungefähr):
- PostgreSQL: ~$5/Monat
- Redis: ~$5/Monat  
- Backend Service: ~$5/Monat
- **Total**: ~$15/Monat für komplette Infrastruktur

## 🎉 Success!

Nach erfolgreichem Setup hast du eine **vollständig isolierte** Auto-Alert SaaS Infrastruktur in Railway mit:

- ✅ Eigene PostgreSQL Datenbank
- ✅ Eigener Redis Cache
- ✅ Backend API Service
- ✅ Keine geteilten Resourcen
- ✅ Production-ready Setup
- ✅ Skalierbar und überwachbar

**Deine API ist jetzt live unter**: `https://auto-alert-backend-xyz.up.railway.app` 🚀