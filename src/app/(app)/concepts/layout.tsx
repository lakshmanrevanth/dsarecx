import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Design',
  description:
    'Work through system design learning paths and log the concepts you learn; each one is reviewed on a spaced repetition schedule.',
};

export default function ConceptsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
