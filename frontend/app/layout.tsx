import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    template: '%s | Auto Alert Pro',
    default: 'Auto Alert Pro - Professional Car Alert System',
  },
  description: 'Get instant notifications for new car listings matching your criteria on Mobile.de. Professional voice alerts and email notifications.',
  keywords: ['car alerts', 'mobile.de', 'auto notifications', 'vehicle search', 'voice alerts'],
  authors: [{ name: 'Auto Alert Pro Team' }],
  creator: 'Auto Alert Pro',
  publisher: 'Auto Alert Pro',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: '/',
    siteName: 'Auto Alert Pro',
    title: 'Auto Alert Pro - Professional Car Alert System',
    description: 'Get instant notifications for new car listings matching your criteria on Mobile.de.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Auto Alert Pro',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auto Alert Pro - Professional Car Alert System',
    description: 'Get instant notifications for new car listings matching your criteria on Mobile.de.',
    images: ['/twitter-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            {children}
          </div>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}