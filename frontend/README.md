# Auto Alert Pro - Frontend

Professional car alert system frontend built with Next.js 14, TypeScript, and Tailwind CSS.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 🏗️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **HTTP Client**: Custom API client with retry logic
- **Animations**: Framer Motion
- **Forms**: React Hook Form
- **Notifications**: React Hot Toast
- **Testing**: Jest + React Testing Library

## 📁 Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── app/               # Protected app pages
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Homepage
├── components/            # Reusable components
│   ├── layout/           # Layout components
│   ├── sections/         # Page sections
│   └── ui/               # UI components
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and configurations
├── store/                # Zustand stores
├── styles/               # Additional styles
└── types/                # TypeScript definitions
```

## 🌟 Features

### Core Features
- **Voice Alerts**: Real-time phone call notifications
- **Email Notifications**: Detailed email alerts with images
- **Advanced Filtering**: Full Mobile.de filter support
- **Real-time Updates**: WebSocket integration
- **Mobile Responsive**: Optimized for all devices

### Technical Features
- **Performance Optimized**: Bundle splitting, image optimization
- **SEO Ready**: Meta tags, OpenGraph, structured data
- **Error Boundaries**: Graceful error handling
- **Loading States**: Skeleton loaders and spinners
- **Offline Support**: Service worker integration
- **Analytics**: Built-in performance monitoring

## 🔧 Configuration

### Environment Variables

Create `.env.local` with:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_WS_URL=wss://your-backend.railway.app

# App Configuration
NEXT_PUBLIC_APP_NAME="Auto Alert Pro"
NEXT_PUBLIC_APP_VERSION=1.0.0

# Feature Flags
NEXT_PUBLIC_ENABLE_VOICE_ALERTS=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

## 📦 Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run test         # Run tests
npm run test:watch   # Watch mode tests
npm run analyze      # Bundle analyzer
```

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect Repository**
   ```bash
   vercel
   ```

2. **Set Environment Variables** in Vercel dashboard

3. **Deploy**
   ```bash
   vercel --prod
   ```

### Manual Deployment

1. **Build**
   ```bash
   npm run build
   ```

2. **Deploy** the `.next` folder to your hosting provider

## 🎯 Performance

### Optimization Features
- **Bundle Analysis**: Built-in webpack bundle analyzer
- **Image Optimization**: Next.js Image component
- **Code Splitting**: Automatic route-based splitting
- **Compression**: Gzip/Brotli compression
- **Caching**: Aggressive caching strategies

### Performance Targets
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **Lighthouse Score**: > 90

## 🔒 Security

- **CSP Headers**: Content Security Policy
- **HTTPS Only**: Force secure connections
- **XSS Protection**: Built-in XSS prevention
- **CSRF Protection**: Token-based protection
- **Input Validation**: Comprehensive form validation

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## 📈 Monitoring

- **Error Tracking**: Sentry integration
- **Performance**: Web Vitals monitoring
- **Analytics**: Custom event tracking
- **Uptime**: Health check endpoints

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

- **Documentation**: Check the `/docs` folder
- **Issues**: GitHub Issues
- **Email**: support@autoalertpro.com

---

**Auto Alert Pro** - Never miss the perfect car again! 🚗