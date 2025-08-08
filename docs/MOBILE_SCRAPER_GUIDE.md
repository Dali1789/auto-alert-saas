# Mobile.de Scraper Integration Guide

## 🚀 Überblick

Der Mobile.de Scraper ist eine robuste, vollständig integrierte Lösung für das Auto Alert SaaS System. Er ermöglicht das automatische Durchsuchen von Mobile.de nach Fahrzeugen basierend auf Benutzersuchparametern und sendet Benachrichtigungen bei neuen Treffern.

## 📋 Features

### Core Funktionalitäten
- **Robustes Web Scraping** mit Puppeteer
- **Anti-Detection Maßnahmen** (User-Agent Rotation, Proxy Support)
- **Rate Limiting** für respektvolles Scraping
- **Deduplizierung** von Fahrzeugdaten
- **Background Jobs** für kontinuierliche Überwachung
- **Webhook Integration** für Echtzeit-Benachrichtigungen

### Sicherheit & Compliance
- **Robots.txt Compliance** respektiert die Richtlinien von Mobile.de
- **IP-Rotation** und Proxy-Support
- **Request Throttling** zur Vermeidung von Blockierungen
- **Error Handling** mit exponential backoff
- **Logging** für Monitoring und Debugging

### Performance
- **Paralleles Scraping** mit konfigurierbarer Concurrency
- **Batch Processing** für große Datenmengen
- **Intelligente Caching** und Deduplizierung
- **Memory Management** für Langzeitbetrieb

## 🛠 Installation

### 1. Dependencies installieren

```bash
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
npm install user-agents node-cron cheerio async
```

### 2. Umgebungsvariablen konfigurieren

```env
# Scraper Konfiguration
SCRAPER_REQUEST_DELAY=3000
SCRAPER_MAX_CONCURRENT=3
SCRAPER_TIMEOUT=30000
SCRAPER_MAX_RETRIES=3
SCRAPER_HEADLESS=true
RESPECT_ROBOTS_TXT=true

# Rate Limiting
SCRAPER_MAX_DAILY_REQUESTS=5000
SCRAPER_MAX_HOURLY_REQUESTS=500

# Proxy Konfiguration (optional)
SCRAPER_USE_PROXY=false
SCRAPER_PROXY_LIST=proxy1:8080,proxy2:8080

# Monitoring
MONITORING_HIGH_PRIORITY=*/15 * * * *
MONITORING_MEDIUM_PRIORITY=0 * * * *
MONITORING_LOW_PRIORITY=0 */4 * * *

# Datenbank
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
```

### 3. Logs-Verzeichnis erstellen

```bash
mkdir -p logs
```

## 🚀 Verwendung

### API Endpoints

#### 1. Fahrzeuge suchen
```http
POST /api/search/search-cars
Content-Type: application/json

{
  "make": "BMW",
  "model": "3er",
  "priceFrom": 15000,
  "priceTo": 50000,
  "yearFrom": 2015,
  "fuel": "Diesel",
  "transmission": "Automatik",
  "zipcode": "10115",
  "radius": 50,
  "saveSearch": true,
  "alertName": "BMW 3er Diesel"
}
```

**Response:**
```json
{
  "requestId": "abc123",
  "searchParams": {...},
  "results": {
    "count": 25,
    "vehicles": [...],
    "searchDuration": 15000,
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "searchId": "search_123",
  "stats": {
    "requestCount": 150,
    "blockedProxies": 0,
    "activePagesCount": 3
  }
}
```

#### 2. Gespeicherte Suchen verwalten
```http
GET /api/search/saved           # Alle gespeicherten Suchen
PUT /api/search/saved/:id       # Suche aktualisieren
DELETE /api/search/saved/:id    # Suche löschen
```

#### 3. Fahrzeugdetails abrufen
```http
GET /api/search/vehicle/:id/details
```

#### 4. Statistiken abrufen
```http
GET /api/search/stats
```

### Background Monitoring

#### Monitoring-Service starten
```bash
# Als Teil der Hauptanwendung
npm start

# Standalone für Monitoring
npm run start:monitoring:standalone
```

#### Manueller Trigger
```http
POST /api/monitoring/trigger
POST /api/monitoring/trigger/:searchId
```

## 📊 Monitoring & Logging

### Log-Dateien
- `logs/mobile-scraper.log` - Allgemeine Scraper-Logs
- `logs/mobile-scraper-error.log` - Fehler-Logs
- `logs/search-routes.log` - API Route Logs
- `logs/monitoring-jobs.log` - Background Job Logs
- `logs/scraper-security.log` - Sicherheits-Logs

### Metriken überwachen
```bash
# Health Check
curl http://localhost:3001/health

# Statistiken
curl http://localhost:3001/stats

# Manueller Trigger
curl -X POST http://localhost:3001/trigger
```

## 🔧 Konfiguration

### Scraper-Einstellungen anpassen

```javascript
const scraper = new MobileDEScraper({
  maxConcurrent: 2,           // Anzahl paralleler Browser-Tabs
  requestDelay: 5000,         // Delay zwischen Requests (ms)
  timeout: 45000,             // Request timeout (ms)
  maxRetries: 3,              // Anzahl Wiederholungen
  respectRobotsTxt: true,     // robots.txt beachten
  useProxy: false,            // Proxy verwenden
  proxyList: []               // Liste von Proxy-Servern
});
```

### Monitoring-Jobs konfigurieren

```javascript
// In src/jobs/monitoring.js
scheduleJobs() {
  // Alle 15 Minuten - hohe Priorität
  this.jobs.set('high-priority', cron.schedule('*/15 * * * *', () => {
    this.runMonitoringCycle('high');
  }));

  // Stündlich - mittlere Priorität
  this.jobs.set('medium-priority', cron.schedule('0 * * * *', () => {
    this.runMonitoringCycle('medium');
  }));

  // Alle 4 Stunden - niedrige Priorität
  this.jobs.set('low-priority', cron.schedule('0 */4 * * *', () => {
    this.runMonitoringCycle('low');
  }));
}
```

## 🧪 Testing

### Unit Tests ausführen
```bash
npm run test:scraper
```

### Manuelle Tests
```bash
# Einzelne Suche testen
node -e "
const MobileDEScraper = require('./src/services/mobile-scraper');
const scraper = new MobileDEScraper();
scraper.initialize().then(() => {
  return scraper.searchVehicles({
    make: 'BMW',
    model: '3er',
    priceFrom: 15000,
    priceTo: 50000
  });
}).then(results => {
  console.log('Results:', results.length);
  process.exit(0);
}).catch(console.error);
"
```

## ⚡ Performance Optimierung

### Browser-Pool optimieren
```javascript
// Für hohe Concurrency
const scraper = new MobileDEScraper({
  maxConcurrent: 5,
  browserPool: {
    min: 2,
    max: 10,
    idleTimeout: 300000
  }
});
```

### Memory Management
```javascript
// Garbage Collection aktivieren
setInterval(() => {
  if (global.gc) {
    global.gc();
  }
}, 300000); // Alle 5 Minuten
```

### Batch Processing
```javascript
// Große Datenmengen in Batches verarbeiten
const batchSize = 50;
for (let i = 0; i < vehicles.length; i += batchSize) {
  const batch = vehicles.slice(i, i + batchSize);
  await processBatch(batch);
  
  // Pause zwischen Batches
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

## 🔒 Sicherheit

### Rate Limiting konfigurieren
```javascript
app.use('/api/search', createScraperRateLimit({
  windowMs: 15 * 60 * 1000,   // 15 Minuten
  max: 20,                    // Max 20 Requests pro IP
  message: 'Too many search requests'
}));
```

### Proxy Rotation einrichten
```javascript
const proxies = [
  'proxy1.example.com:8080',
  'proxy2.example.com:8080',
  'proxy3.example.com:8080'
];

const scraper = new MobileDEScraper({
  useProxy: true,
  proxyList: proxies
});
```

### User-Agent Rotation
```javascript
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36...'
];

// Wird automatisch rotiert
```

## 🚨 Error Handling

### Häufige Fehler und Lösungen

#### 1. TimeoutError
```javascript
// Timeout erhöhen
const scraper = new MobileDEScraper({
  timeout: 60000  // 60 Sekunden
});
```

#### 2. Blocked by server (403/429)
```javascript
// Längere Delays verwenden
const scraper = new MobileDEScraper({
  requestDelay: 10000,  // 10 Sekunden
  maxConcurrent: 1      // Nur ein Request gleichzeitig
});
```

#### 3. Memory Leaks
```javascript
// Regelmäßige Cleanup-Zyklen
setInterval(async () => {
  await scraper.cleanup();
  await scraper.initialize();
}, 3600000); // Jede Stunde
```

#### 4. Captcha/Bot-Detection
```javascript
// Stealth-Plugin aktivieren
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
```

## 📈 Monitoring Dashboard

### Wichtige Metriken
- **Request Rate**: Requests pro Stunde/Tag
- **Success Rate**: Erfolgreiche vs. fehlgeschlagene Requests
- **Average Response Time**: Durchschnittliche Antwortzeit
- **Vehicle Discovery Rate**: Neue Fahrzeuge pro Stunde
- **Error Rate**: Fehlerquote nach Typ

### Alerting einrichten
```javascript
// Benachrichtigung bei hoher Fehlerrate
if (errorRate > 0.1) {
  await notificationService.sendAlert({
    type: 'high_error_rate',
    message: `Scraper error rate: ${errorRate * 100}%`,
    severity: 'warning'
  });
}
```

## 🔄 Wartung

### Tägliche Wartungsaufgaben
```bash
# Logs rotieren
find logs/ -name "*.log" -mtime +7 -delete

# Alte Fahrzeugdaten löschen (automatisch via Cleanup-Job)

# Performance-Metriken überprüfen
curl http://localhost:3001/stats | jq .
```

### Wöchentliche Aufgaben
- Proxy-Liste aktualisieren
- User-Agent Strings aktualisieren
- Robots.txt Changes überprüfen
- Performance-Trends analysieren

## 📞 Support

Bei Problemen oder Fragen:

1. **Logs überprüfen**: Schauen Sie in die entsprechenden Log-Dateien
2. **Metriken analysieren**: Nutzen Sie die `/stats` Endpoints
3. **Rate Limits prüfen**: Überprüfen Sie die aktuellen Rate Limits
4. **Proxy Status**: Testen Sie die Proxy-Verbindungen

### Debug-Modus aktivieren
```bash
DEBUG_MODE=true npm start
```

### Verbose Logging
```bash
LOG_LEVEL=debug npm start
```

---

## 📝 Changelog

### Version 1.0.0
- Initial Release mit vollem Feature-Set
- Mobile.de Integration
- Background Monitoring
- Security & Rate Limiting
- Performance Optimierungen

---

**Entwickelt für das Auto Alert SaaS System**
*Letzte Aktualisierung: Januar 2024*