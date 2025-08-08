'use client';

import { motion } from 'framer-motion';
import { CheckIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

const plans = [
  {
    name: 'Starter',
    price: '0',
    period: 'Kostenlos',
    description: 'Perfekt zum Ausprobieren',
    features: [
      '1 aktiver Alert',
      'E-Mail Benachrichtigungen',
      'Basis Mobile.de Filter',
      'Standard-Support'
    ],
    popular: false,
    cta: 'Kostenlos starten',
    badge: null
  },
  {
    name: 'Pro',
    price: '19',
    period: '/ Monat',
    description: 'Für ernsthafte Autosucher',
    features: [
      'Unbegrenzte Alerts',
      'Voice-Call Benachrichtigungen',
      'Alle Mobile.de Filter',
      'Real-time Monitoring',
      'Priority Support',
      'Detaillierte Analytics',
      'Mobile App (Beta)'
    ],
    popular: true,
    cta: 'Pro testen',
    badge: 'BELIEBT'
  },
  {
    name: 'Premium',
    price: '49',
    period: '/ Monat',
    description: 'Für Autohändler & Power-User',
    features: [
      'Alle Pro Features',
      'Multi-Plattform Monitoring',
      'API Zugang',
      'White-Label Option',
      'Dedicated Support',
      'Custom Voice Messages',
      'Advanced Analytics',
      'Team Collaboration'
    ],
    popular: false,
    cta: 'Premium testen',
    badge: 'BUSINESS'
  },
];

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false);

  const getPrice = (basePrice: string) => {
    if (basePrice === '0') return '0';
    const price = parseInt(basePrice);
    return isAnnual ? Math.round(price * 10).toString() : basePrice;
  };

  const getPeriod = (basePeriod: string) => {
    if (basePeriod === 'Kostenlos') return 'Kostenlos';
    return isAnnual ? '/ Jahr' : basePeriod;
  };

  return (
    <section id="pricing" className="py-20 bg-white">
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
            Einfache,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">
              transparente Preise
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-xl text-gray-600 mb-8"
          >
            Wählen Sie den Plan, der perfekt zu Ihren Bedürfnissen passt
          </motion.p>

          {/* Billing Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
            className="inline-flex items-center bg-gray-100 rounded-full p-1"
          >
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                !isAnnual 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monatlich
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                isAnnual 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Jährlich
              <span className="ml-1 text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded">
                -17%
              </span>
            </button>
          </motion.div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              viewport={{ once: true }}
              className={`relative rounded-2xl p-8 ${
                plan.popular
                  ? 'bg-gradient-to-b from-primary-50 to-white border-2 border-primary-200 shadow-xl scale-105'
                  : 'bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300'
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold ${
                  plan.badge === 'BELIEBT' 
                    ? 'bg-primary-100 text-primary-700'
                    : plan.badge === 'BUSINESS'
                    ? 'bg-purple-100 text-purple-700'
                    : ''
                }`}>
                  {plan.badge}
                </div>
              )}

              {/* Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-gray-600 mb-6">
                  {plan.description}
                </p>
                
                {/* Price */}
                <div className="flex items-baseline justify-center mb-2">
                  <span className="text-5xl font-bold text-gray-900">
                    €{getPrice(plan.price)}
                  </span>
                  <span className="text-xl text-gray-500 ml-1">
                    {getPeriod(plan.period)}
                  </span>
                </div>
                
                {isAnnual && plan.price !== '0' && (
                  <p className="text-sm text-green-600">
                    Spare €{parseInt(plan.price) * 2} pro Jahr
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start">
                    <div className="flex-shrink-0 mr-3 mt-0.5">
                      <CheckIcon className="w-5 h-5 text-green-500" />
                    </div>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 ${
                plan.popular
                  ? 'btn-primary shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                  : 'btn-secondary hover:bg-gray-200'
              }`}>
                {plan.cta}
              </button>

              {plan.name === 'Pro' && (
                <p className="text-xs text-center text-gray-500 mt-3">
                  ✨ 14 Tage kostenlos testen • Jederzeit kündbar
                </p>
              )}
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
          <div className="glass rounded-2xl p-8 max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              🎯 Nicht sicher welcher Plan der richtige ist?
            </h3>
            <p className="text-gray-600 mb-6">
              Starten Sie kostenlos und upgraden Sie jederzeit wenn Sie mehr Features benötigen.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="btn-primary px-8 py-3">
                Kostenlos starten
              </button>
              <button className="btn-secondary px-8 py-3">
                Beratungstermin buchen
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}