import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Sign in',
  description: `Sign in or create your ${siteConfig.name} account to keep your DSA problems and system design concepts on a spaced repetition schedule.`,
  robots: { index: false, follow: true },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
