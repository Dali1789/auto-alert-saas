'use client';

import { motion } from 'framer-motion';
import { 
  PhoneIcon,
  EnvelopeIcon,
  AdjustmentsHorizontalIcon,
  ClockIcon,
  ShieldCheckIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

const features = [
  {
    name: 'Sofortige Voice-Anrufe',
    description: 'Erhalten Sie personalisierte Anrufe mit allen wichtigen Fahrzeugdetails - perfekt für unterwegs.',
    icon: PhoneIcon,
    color: 'from-pink-500 to-rose-500',
    badge: 'EXKLUSIV'
  },
  {
    name: 'E-Mail Benachrichtigungen',
    description: 'Detaillierte E-Mails mit Bildern, Preisen und direkten Links zu Mobile.de.',
    icon: EnvelopeIcon,
    color: 'from-blue-500 to-cyan-500'
  },
  {
    name: 'Erweiterte Filter',
    description: 'Nutzen Sie alle Mobile.de Filter: Marke, Modell, Preis, Kilometerstand, Ausstattung und mehr.',
    icon: AdjustmentsHorizontalIcon,
    color: 'from-purple-500 to-indigo-500'
  },
  {
    name: 'Real-time Monitoring',
    description: '24/7 Überwachung aller neuen Inserate - Sie verpassen garantiert nichts.',
    icon: ClockIcon,
    color: 'from-green-500 to-emerald-500'
  },
  {
    name: 'Sichere & Zuverlässig',
    description: 'DSGVO-konforme Datenverarbeitung und 99.9% Verfügbarkeit.',
    icon: ShieldCheckIcon,
    color: 'from-orange-500 to-red-500'
  },
  {
    name: 'Detaillierte Analytics',
    description: 'Verfolgen Sie Markttrends, Preisentwicklungen und Ihre Alert-Performance.',
    icon: ChartBarIcon,
    color: 'from-teal-500 to-cyan-500'
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-gray-900 mb-6"
          >
            Alles was Sie brauchen,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">
              an einem Ort
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-xl text-gray-600"
          >
            Professionelle Auto-Alerts mit modernster Technologie für maximale Effizienz
          </motion.p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="relative card-gradient rounded-2xl p-8 hover:shadow-xl transition-all duration-300 group"
            >
              {/* Badge */}
              {feature.badge && (
                <div className="absolute top-4 right-4 voice-badge text-xs">
                  {feature.badge}
                </div>
              )}

              {/* Icon */}
              <div className={`w-12 h-12 bg-gradient-to-r ${feature.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {feature.name}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>

              {/* Hover Effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500 to-purple-500 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className="inline-flex items-center space-x-4 glass rounded-2xl px-8 py-4">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 bg-gradient-to-r from-primary-500 to-purple-500 rounded-full border-2 border-white flex items-center justify-center text-white font-bold text-sm"
                >
                  {i}
                </div>
              ))}
            </div>
            <div className="text-left">
              <div className="font-semibold text-gray-900">Über 2,500+ zufriedene Nutzer</div>
              <div className="text-sm text-gray-600">vertrauen bereits auf Auto Alert Pro</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}