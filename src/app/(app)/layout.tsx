import { Sidebar } from '@/components/sidebar';
import { Providers } from '@/components/providers';
import { MobileNav } from '@/components/app/mobile-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen bg-background text-foreground">
        <Sidebar />
        <main
          id="main"
          tabIndex={-1}
          data-main-content
          className="min-h-screen min-w-0 outline-none md:pl-60"
        >
          {/* Bottom padding clears the mobile dock. */}
          <div className="mx-auto w-full max-w-[1200px] px-4 pb-28 pt-8 sm:px-6 md:px-10 md:pb-20 md:pt-12">
            {children}
          </div>
        </main>
        <MobileNav />
      </div>
    </Providers>
  );
}
