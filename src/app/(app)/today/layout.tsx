import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Today',
  description: 'What you learned today, what is due for review, and your list of DSA problems and system design concepts to learn next.',
};

export default function TodayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
