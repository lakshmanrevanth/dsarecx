import type { Metadata } from 'next';
import { siteTitle } from '@/config/site';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Science } from '@/components/landing/science';
import { QueueSection, TrackerSection } from '@/components/landing/demos';
import { Capabilities } from '@/components/landing/capabilities';
import { FAQ } from '@/components/landing/faq';
import { FinalCTA } from '@/components/landing/final-cta';
import { SectionIndicator } from '@/components/landing/section-indicator';

export const metadata: Metadata = {
  title: { absolute: siteTitle },
};

const SECTIONS = [
  { id: 'intro', label: 'Intro' },
  { id: 'how', label: 'How it works' },
  { id: 'science', label: 'The science' },
  { id: 'queue', label: 'Daily queue' },
  { id: 'tracker', label: 'Tracker' },
  { id: 'features', label: 'Features' },
  { id: 'faq', label: 'FAQ' },
  { id: 'start', label: 'Get started' },
];

export default function LandingPage() {
  return (
    <>
      <SectionIndicator sections={SECTIONS} />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <HowItWorks />
        <Science />
        <QueueSection />
        <TrackerSection />
        <Capabilities />
        <FAQ />
        <FinalCTA />
      </main>
    </>
  );
}
