import { Metadata } from 'next';
import { HeroSection } from '@/components/sections/hero-section';
import { FeaturesSection } from '@/components/sections/features-section';
import { HowItWorksSection } from '@/components/sections/how-it-works-section';
import { PricingSection } from '@/components/sections/pricing-section';
import { TestimonialsSection } from '@/components/sections/testimonials-section';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';

export const metadata: Metadata = {
  title: 'Auto Alert Pro - Professional Car Alert System',
  description: 'Get instant voice and email notifications for new car listings matching your criteria on Mobile.de. Professional car alert system with advanced filtering.',
};

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Header />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <TestimonialsSection />
      <Footer />
    </main>
  );
}