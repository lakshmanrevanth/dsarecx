'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Brand } from '@/components/brand';
import { cn } from '@/lib/utils';
import { GitHubStarButton } from './github-star-button';
import { ThemeSwitch } from './theme-switch';

const LINKS = [
  { href: '/#how', label: 'How it works' },
  { href: '/#science', label: 'Science' },
  { href: '/#features', label: 'Features' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile sheet on navigation and with Escape.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      <nav
        aria-label="Main"
        className={cn(
          'mx-auto flex h-14 max-w-[960px] items-center justify-between gap-3 rounded-full border pl-5 pr-2 transition-[background,box-shadow,border-color] duration-200',
          scrolled || open
            ? 'border-border bg-card/85 shadow-[var(--shadow-card)] backdrop-blur-md'
            : 'border-border/70 bg-background/60 backdrop-blur-sm',
        )}
      >
        <Brand size="md" />

        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => {
            const active = l.href === pathname;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-full px-3 py-2 text-[14px] text-muted-foreground transition-colors hover:text-foreground',
                    active && 'text-foreground',
                  )}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-1.5">
          <GitHubStarButton className="hidden sm:inline-flex" />
          <ThemeSwitch className="hidden sm:inline-flex" />
          <Link href="/auth/login" className="btn btn-ghost hidden text-foreground md:inline-flex">
            Sign in
          </Link>
          <Link href="/today" className="btn btn-ember">
            Open app
            <ArrowUpRight size={15} aria-hidden />
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="btn btn-ghost btn-icon lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
          </button>
        </div>
      </nav>

      {open ? (
        <div id="mobile-nav" className="card mx-auto mt-2 max-w-[960px] p-2 lg:hidden">
          <ul>
            {LINKS.map((l, i) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-baseline gap-3 rounded-lg px-3 py-3 text-[15px] hover:bg-muted"
                >
                  <span className="font-mono text-[11px] text-faint">0{i + 1}</span>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/auth/login" onClick={() => setOpen(false)} className="flex items-baseline gap-3 rounded-lg px-3 py-3 text-[15px] hover:bg-muted">
                <span className="font-mono text-[11px] text-faint">0{LINKS.length + 1}</span>
                Sign in
              </Link>
            </li>
          </ul>
          <div className="mt-1 flex items-center justify-between border-t border-border px-2 pt-2">
            <GitHubStarButton />
            <ThemeSwitch />
          </div>
        </div>
      ) : null}
    </header>
  );
}
