'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { signOut, useSession } from 'next-auth/react';
import { BarChart3, LogOut, MessageSquare, MoreHorizontal, Settings, X } from 'lucide-react';
import { FeedbackModal } from '@/components/feedback-modal';
import { ThemeToggle } from '@/components/theme-toggle';
import { NAV_ITEMS, isActivePath } from '@/components/sidebar/nav-items';
import { formatBadge, useDueCount } from '@/components/sidebar/use-due-count';
import { cn } from '@/lib/utils';

// Stats and Settings live in the "More" sheet so the dock fits on a 360px phone.
const DOCK_ITEMS = NAV_ITEMS.filter((i) => i.href !== '/settings' && i.href !== '/stats');

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Bottom dock for phones (<768px) plus a "More" sheet with Stats, Settings, theme, Feedback and Sign out. */
export function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const due = useDueCount();
  const reduceMotion = useReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetTitleId = useId();
  const settingsActive = isActivePath(pathname, '/settings');
  const statsActive = isActivePath(pathname, '/stats');
  const moreActive = settingsActive || statsActive;

  const closeMore = useCallback((restoreFocus = true) => {
    setMoreOpen(false);
    if (restoreFocus) window.setTimeout(() => moreBtnRef.current?.focus(), 0);
  }, []);

  // Escape closes the sheet, Tab stays inside it, focus starts on its first item.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMore();
        return;
      }
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const items = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen, closeMore]);

  const sheetRow =
    'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] text-foreground transition-colors hover:bg-muted';

  return (
    <>
      <nav
        data-mobile-nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
          {DOCK_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            const showBadge = item.dueBadge && due !== null && due > 0;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-16 flex-col items-center justify-center gap-1 rounded-none text-[11px] transition-colors',
                    active ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {active && <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-ember" />}
                  <span className="relative">
                    <Icon size={20} strokeWidth={1.75} aria-hidden />
                    {showBadge && (
                      <span
                        aria-hidden
                        className="absolute -right-3 -top-1.5 min-w-[18px] rounded-full bg-ember px-1 text-center font-mono text-[10px] leading-[16px] text-ember-foreground ring-2 ring-card"
                      >
                        {formatBadge(due!)}
                      </span>
                    )}
                  </span>
                  <span>
                    {item.short}
                    {showBadge && <span className="sr-only">, {due} due today</span>}
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              ref={moreBtnRef}
              type="button"
              onClick={() => (moreOpen ? closeMore() : setMoreOpen(true))}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-label={moreActive ? `More (current section: ${statsActive ? 'Stats' : 'Settings'})` : 'More'}
              className={cn(
                'relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] transition-colors',
                moreOpen || moreActive ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {moreActive && <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-ember" />}
              <MoreHorizontal size={20} strokeWidth={1.75} aria-hidden />
              <span aria-hidden>More</span>
            </button>
          </li>
        </ul>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <div className="fixed inset-0 z-[85] md:hidden">
            <motion.div
              className="absolute inset-0 bg-[var(--overlay)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.15 }}
              onClick={() => closeMore()}
              aria-hidden
            />
            <motion.div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={sheetTitleId}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-0 bottom-0 rounded-t-[22px] border-t border-border bg-popover px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3 shadow-[var(--shadow-pop)]"
            >
              <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />
              <div className="flex items-start justify-between gap-3 px-1">
                <div className="min-w-0">
                  <p className="eyebrow" id={sheetTitleId}>
                    More
                  </p>
                  {session?.user && (
                    <p className="mt-2 truncate text-sm text-muted-foreground">
                      {session.user.name || session.user.email}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => closeMore()} aria-label="Close" className="btn btn-ghost btn-icon btn-sm">
                  <X size={16} strokeWidth={1.75} aria-hidden />
                </button>
              </div>

              <div className="mt-5 px-1">
                <p className="label">Theme</p>
                <ThemeToggle variant="segmented" />
              </div>

              <div className="mt-5 border-t border-border pt-2">
                <Link
                  href="/stats"
                  aria-current={statsActive ? 'page' : undefined}
                  onClick={() => closeMore(false)}
                  className={cn(sheetRow, statsActive && 'bg-muted font-medium')}
                >
                  <BarChart3 size={18} strokeWidth={1.75} aria-hidden className="text-muted-foreground" />
                  Stats
                  {statsActive && <span className="ember-dot ml-auto h-1.5 w-1.5" aria-hidden />}
                </Link>
                <Link
                  href="/settings"
                  aria-current={settingsActive ? 'page' : undefined}
                  onClick={() => closeMore(false)}
                  className={cn(sheetRow, settingsActive && 'bg-muted font-medium')}
                >
                  <Settings size={18} strokeWidth={1.75} aria-hidden className="text-muted-foreground" />
                  Settings
                  {settingsActive && <span className="ember-dot ml-auto h-1.5 w-1.5" aria-hidden />}
                </Link>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  className={sheetRow}
                  onClick={() => {
                    closeMore(false);
                    setFeedbackOpen(true);
                  }}
                >
                  <MessageSquare size={18} strokeWidth={1.75} aria-hidden className="text-muted-foreground" />
                  Feedback
                </button>
                <button type="button" className={cn(sheetRow, 'text-error')} onClick={() => signOut({ callbackUrl: '/' })}>
                  <LogOut size={18} strokeWidth={1.75} aria-hidden />
                  Sign out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => {
          setFeedbackOpen(false);
          window.setTimeout(() => moreBtnRef.current?.focus(), 0);
        }}
      />
    </>
  );
}
