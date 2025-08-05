# 🚗 Auto-Alert SaaS Platform

**Automatische Fahrzeugüberwachung für Mobile.de und AutoScout24 mit KI-gestützten Voice-Benachrichtigungen**

## ✨ Features

- 🔍 **Real-Time Monitoring** - Überwachung alle 30-60 Sekunden
- 📞 **Voice-Call Alerts** - Sofortige Anrufe bei Traumpreisen (via Retell AI)
- 📧 **Multi-Channel Notifications** - Email, SMS, Voice-Calls
- 🎯 **Smart Filtering** - KI-gestützte Priorisierung
- 📱 **Mobile-First Design** - Progressive Web App
- 🚀 **Modern Tech Stack** - Next.js 14, Supabase, Retell AI

## 🏗️ Architektur

```
Frontend (Next.js)     Backend (Node.js)     Database (Supabase)
       │                       │                       │
       ├─ User Dashboard        ├─ Notification API     ├─ Users
       ├─ Search Management     ├─ Webhook Handler      ├─ Searches  
       └─ Results Display       └─ Retell Integration   └─ Results
                                       │
                               Scraping Engine (n8n)
                                       │
                            Mobile.de + AutoScout24 APIs
```

## 🚀 Quick Start

### Local Development
```bash
git clone https://github.com/Dali1789/auto-alert-saas.git
cd auto-alert-saas

# Frontend
cd frontend
npm install
npm run dev

# Backend
cd ../railway/notification-service
npm install
npm run dev
```

## 📊 Competitive Advantage

| Feature | AutoRadarX | **Our Platform** |
|---------|------------|------------------|
| Email Alerts | ✅ | ✅ |
| SMS Alerts | ✅ (Premium) | ✅ |
| **Voice-Call Alerts** | ❌ | **✅ Unique!** |
| Real-Time Updates | ~5-15 min | **30-60 sec** |
| Modern UI/UX | ❌ | **✅ 2024 Design** |
| Mobile App | Premium only | **✅ PWA** |

## 💰 Business Model

- **Free:** 2 Suchen, Email-Alerts
- **Voice Pro (€14.99/month):** 10 Suchen + SMS + Voice-Calls
- **Voice Business (€24.99/month):** 50 Suchen + Priority + API

## 📞 Voice-Alert Innovation

**Unser Alleinstellungsmerkmal:** Sofortige Anrufe bei interessanten Fahrzeugen!

> "Während AutoRadarX Ihnen mailt, rufen wir Sie an!" 
> 
> Bei einem BMW 740d für €15.000 zählt jede Sekunde.

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, Tailwind CSS, Shadcn/ui
- **Backend:** Node.js, Express, Supabase
- **Voice:** Retell AI (Text-to-Speech + Voice Calls)
- **Email:** Resend API
- **Scraping:** n8n Workflows
- **Database:** PostgreSQL (Supabase)
- **Deployment:** Vercel (Frontend) + Railway (Backend)

---

**Made with ❤️ for car enthusiasts who don't want to miss their dream car!**