'use client';

import { motion } from 'framer-motion';
import { 
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  BellIcon,
  PhoneIcon
} from '@heroicons/react/24/outline';

const steps = [
  {
    number: '01',
    title: 'Filter konfigurieren',
    description: 'Definieren Sie Ihre Wunschkriterien: Marke, Modell, Preis, Ausstattung und mehr.',
    icon: AdjustmentsHorizontalIcon,
    color: 'from-blue-500 to-cyan-500'
  },
  {
    number: '02',
    title: 'Mobile.de überwachen',
    description: 'Unsere KI überwacht kontinuierlich alle neuen Inserate in Echtzeit.',
    icon: MagnifyingGlassIcon,
    color: 'from-purple-500 to-pink-500'
  },
  {
    number: '03',
    title: 'Match erkennen',
    description: 'Sobald ein Fahrzeug Ihren Kriterien entspricht, wird automatisch ein Alert ausgelöst.',
    icon: BellIcon,
    color: 'from-orange-500 to-red-500'
  },
  {
    number: '04',
    title: 'Voice-Call erhalten',
    description: 'Erhalten Sie sofort einen personalisierten Anruf mit allen wichtigen Details.',
    icon: PhoneIcon,
    color: 'from-green-500 to-emerald-500'
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 bg-gray-50">
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
            So funktioniert{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">
              Auto Alert Pro
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-xl text-gray-600"
          >
            In nur 4 einfachen Schritten zu Ihrem Traumauto
          </motion.p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-24 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary-200 via-purple-200 to-green-200 transform -translate-x-1/2" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="relative text-center"
              >
                {/* Step Number */}
                <div className="relative z-10 inline-flex items-center justify-center w-16 h-16 bg-white rounded-full border-4 border-gray-200 text-primary-600 font-bold text-lg mb-6 mx-auto">
                  {step.number}
                </div>

                {/* Icon */}
                <div className={`inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r ${step.color} rounded-xl mb-4`}>
                  <step.icon className="w-6 h-6 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {step.description}
                </p>

                {/* Arrow (Mobile) */}
                {index < steps.length - 1 && (
                  <div className="lg:hidden flex justify-center mt-8 mb-4">
                    <div className="w-0.5 h-8 bg-gradient-to-b from-primary-300 to-transparent" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Demo Call */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          viewport={{ once: true }}
          className="mt-16 max-w-4xl mx-auto"
        >
          <div className="glass rounded-2xl p-8">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                📞 Beispiel Voice-Alert
              </h3>
              <p className="text-gray-600">
                Hören Sie sich an, wie ein typischer Alert-Anruf klingt
              </p>
            </div>

            <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-6 border border-pink-200">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
                    <PhoneIcon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="text-gray-800 italic">
                      "Guten Tag! Hier ist Ihr Auto Alert Service. Wir haben einen interessanten BMW 740d für Sie gefunden: 
                      Baujahr 2018, nur 89.000 km, Automatik, für €42.900 in München. 
                      Das Fahrzeug entspricht exakt Ihren Suchkriterien. Soll ich Ihnen den Link per E-Mail senden?"
                    </p>
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    ✨ Personalisiert • 🕒 Sofortig • 📍 Standortbasiert
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center mt-6">
              <button className="btn-primary px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200">
                Jetzt kostenlos testen
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}