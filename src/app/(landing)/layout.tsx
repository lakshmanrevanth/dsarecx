import type { Metadata } from 'next';
import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';

export const metadata: Metadata = {
  description:
    'Spaced repetition for LeetCode, Codeforces, CodeChef, GeeksforGeeks, HackerRank and system design. Review each problem right before you would forget it, so the patterns are there in your interview.',
  keywords: [
    'DSA revision',
    'spaced repetition',
    'LeetCode spaced repetition',
    'LeetCode tracker',
    'Codeforces tracker',
    'CodeChef tracker',
    'GeeksforGeeks tracker',
    'HackerRank tracker',
    'system design revision',
    'coding interview prep',
    'Blind 75 tracker',
    'NeetCode 150 tracker',
    'Striver SDE sheet',
    'Grind 75',
    'active recall coding',
    'Ebbinghaus forgetting curve',
  ],
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper grain relative min-h-screen overflow-x-clip text-foreground">
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}
