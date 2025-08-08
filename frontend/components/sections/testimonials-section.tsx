'use client';

import { motion } from 'framer-motion';
import { StarIcon } from '@heroicons/react/24/solid';

const testimonials = [
  {
    name: 'Michael Weber',
    role: 'Privatperson',
    location: 'München',
    image: '/avatars/michael.jpg',
    rating: 5,
    text: 'Dank Auto Alert Pro habe ich meinen Traumwagen gefunden, bevor er überhaupt online war! Der Voice-Call kam binnen 2 Minuten und ich konnte als Erster zuschlagen.',
    car: 'BMW M3 Competition',
    savings: '€8.500 unter Marktwert'
  },
  {
    name: 'Sarah Müller',
    role: 'Gebrauchtwagenhändlerin',
    location: 'Hamburg',
    image: '/avatars/sarah.jpg',
    rating: 5,
    text: 'Als Händlerin bin ich auf schnelle Alerts angewiesen. Die Voice-Calls verschaffen mir den entscheidenden Vorteil gegenüber der Konkurrenz. Klare Empfehlung!',
    car: 'Verschiedene Modelle',
    savings: 'Umsatz +30%'
  },
  {
    name: 'Thomas Schmidt',
    role: 'IT-Manager',
    location: 'Berlin',
    image: '/avatars/thomas.jpg',
    rating: 5,
    text: 'Perfekte Technologie! Die Filter sind sehr präzise und die Benachrichtigungen kommen sekundenschnell. Habe so mein Elektroauto zum Bestpreis bekommen.',
    car: 'Tesla Model Y',
    savings: '€12.000 gespart'
  }
];

export function TestimonialsSection() {
  return (
    <section className="py-20 bg-gray-50">
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
            Was unsere{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">
              Kunden sagen
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-xl text-gray-600"
          >
            Über 2.500 zufriedene Kunden vertrauen auf Auto Alert Pro
          </motion.p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300"
            >
              {/* Rating */}
              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <StarIcon key={i} className="w-5 h-5 text-yellow-400" />
                ))}
              </div>

              {/* Content */}
              <blockquote className="text-gray-700 mb-6 leading-relaxed">
                "{testimonial.text}"
              </blockquote>

              {/* Success Metrics */}
              <div className="bg-green-50 rounded-xl p-4 mb-6 border border-green-200">
                <div className="text-sm text-green-600 font-medium mb-1">
                  Erfolg mit Auto Alert Pro:
                </div>
                <div className="text-sm text-gray-700">
                  <div>🚗 {testimonial.car}</div>
                  <div>💰 {testimonial.savings}</div>
                </div>
              </div>

              {/* Author */}
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {testimonial.role} • {testimonial.location}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          viewport={{ once: true }}
          className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-6"
        >
          {[
            { number: '2,500+', label: 'Zufriedene Kunden' },
            { number: '15,000+', label: 'Erfolgreiche Alerts' },
            { number: '98.5%', label: 'Erfolgsrate' },
            { number: '<30s', label: 'Durchschnittliche Reaktionszeit' },
          ].map((stat, index) => (
            <div key={stat.label} className="text-center glass rounded-xl p-6">
              <div className="text-3xl font-bold text-primary-600 mb-2">
                {stat.number}
              </div>
              <div className="text-gray-600 text-sm">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className="glass rounded-2xl p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Werden Sie unser nächster Erfolg! 🎯
            </h3>
            <p className="text-gray-600 mb-6">
              Schließen Sie sich tausenden zufriedener Kunden an und finden Sie Ihr Traumauto.
            </p>
            <button className="btn-primary px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200">
              Jetzt kostenlos starten
            </button>
            <p className="text-sm text-gray-500 mt-3">
              ✨ Keine Kreditkarte erforderlich • 14 Tage kostenlos
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}