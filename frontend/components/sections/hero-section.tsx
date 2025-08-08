'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  BellIcon, 
  PhoneIcon, 
  EnvelopeIcon,
  PlayCircleIcon 
} from '@heroicons/react/24/outline';

export function HeroSection() {
  const [emailInput, setEmailInput] = useState('');

  const handleQuickStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput) {
      window.location.href = `/auth/register?email=${encodeURIComponent(emailInput)}`;
    }
  };

  return (
    <section className="relative pt-20 pb-16 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-hero-pattern opacity-10" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center space-x-2 bg-primary-50 text-primary-700 px-4 py-2 rounded-full text-sm font-medium mb-6"
          >
            <BellIcon className="w-4 h-4" />
            <span>🔥 Exklusive Voice-Alerts verfügbar</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 text-balance"
          >
            Nie wieder das{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">
              perfekte Auto
            </span>{' '}
            verpassen
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto text-balance"
          >
            Erhalten Sie sofortige <strong>Voice-Anrufe</strong> und E-Mail-Benachrichtigungen, 
            sobald neue Fahrzeuge auf Mobile.de erscheinen, die Ihren Kriterien entsprechen.
          </motion.p>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-wrap justify-center items-center gap-6 mb-10"
          >
            <div className="flex items-center space-x-2 text-gray-700">
              <PhoneIcon className="w-5 h-5 text-pink-500" />
              <span className="font-medium">Sofortige Voice-Calls</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-700">
              <EnvelopeIcon className="w-5 h-5 text-blue-500" />
              <span className="font-medium">E-Mail-Alerts</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-700">
              <BellIcon className="w-5 h-5 text-green-500" />
              <span className="font-medium">Real-time Monitoring</span>
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="max-w-md mx-auto"
          >
            <form onSubmit={handleQuickStart} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Ihre E-Mail für kostenlose Alerts"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center sm:text-left"
                required
              />
              <button
                type="submit"
                className="btn-primary px-8 py-3 text-base font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
              >
                Kostenlos starten
              </button>
            </form>
            <p className="text-sm text-gray-500 mt-3">
              ✨ Kostenlos • Keine Kreditkarte erforderlich • Sofort einsatzbereit
            </p>
          </motion.div>

          {/* Video Demo */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="mt-16"
          >
            <button className="group relative inline-flex items-center space-x-3 text-primary-600 font-medium hover:text-primary-700 transition-colors duration-200">
              <div className="relative">
                <PlayCircleIcon className="w-12 h-12 group-hover:scale-110 transition-transform duration-200" />
                <div className="absolute inset-0 bg-primary-600 rounded-full opacity-20 animate-ping group-hover:animate-none" />
              </div>
              <span>Demo ansehen (2 Min.)</span>
            </button>
          </motion.div>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-center"
        >
          <div className="glass rounded-2xl p-6">
            <div className="text-3xl font-bold text-primary-600 mb-2">98.5%</div>
            <div className="text-gray-600">Erfolgsrate bei Voice-Alerts</div>
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="text-3xl font-bold text-primary-600 mb-2">&lt;30s</div>
            <div className="text-gray-600">Durchschnittliche Reaktionszeit</div>
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="text-3xl font-bold text-primary-600 mb-2">24/7</div>
            <div className="text-gray-600">Kontinuierliche Überwachung</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}