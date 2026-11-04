import type { Metadata } from 'next';
import { Pixel404Shooter } from '@/components/pixel-shooter/pixel-404-shooter';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'This page does not exist. Shoot down a few 404s on your way back.',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="paper grain min-h-[100dvh] w-full overflow-x-clip outline-none">
      <Pixel404Shooter />
    </main>
  );
}
