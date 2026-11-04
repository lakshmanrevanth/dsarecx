'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LogOut, MessageSquare } from 'lucide-react';
import { Brand } from '@/components/brand';
import { FeedbackModal } from '@/components/feedback-modal';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, isActivePath } from './nav-items';
import { formatBadge, useDueCount } from './use-due-count';

function initialsOf(name?: string | null, email?: string | null): string {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 && name ? parts[1][0] : '')).toUpperCase();
}

/** Desktop navigation (≥768px). The mobile dock lives in components/app/mobile-nav. */
export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const due = useDueCount();
  const user = session?.user;

  return (
    <>
      <aside
        data-sidebar
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-background-deep/60 px-4 pb-5 pt-7 md:flex"
      >
        <div className="px-2">
          <Brand href="/today" size="sm" />
        </div>

        <p className="eyebrow eyebrow-plain mt-10 px-3 text-[10px]">Workspace</p>
        <nav aria-label="Main" className="mt-3 flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            const showBadge = item.dueBadge && due !== null && due > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex h-10 items-center gap-3 rounded-full px-3 text-[14px] transition-colors',
                  active
                    ? 'bg-card font-medium text-foreground shadow-[var(--shadow-card)] ring-1 ring-border'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon
                  size={16}
                  strokeWidth={1.75}
                  aria-hidden
                  className={cn(active ? 'text-foreground' : 'text-faint group-hover:text-foreground')}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {showBadge ? (
                  <>
                    <span
                      aria-hidden
                      className="rounded-full bg-ember px-2 py-px font-mono text-[11px] font-medium leading-[18px] text-ember-foreground"
                    >
                      {formatBadge(due!)}
                    </span>
                    <span className="sr-only">, {due} due today</span>
                  </>
                ) : active ? (
                  <span className="ember-dot h-1.5 w-1.5" aria-hidden />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 px-1">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setFeedbackOpen(true)}
              className="btn btn-ghost btn-sm -ml-1 gap-2 px-2.5"
            >
              <MessageSquare size={15} strokeWidth={1.75} aria-hidden />
              Feedback
            </button>
            <ThemeToggle variant="sidebar" />
          </div>

          <div className="border-t border-border pt-4">
            {user ? (
              <div className="flex items-center gap-3 px-1">
                <span
                  aria-hidden
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card font-serif text-[17px] italic text-foreground"
                >
                  {initialsOf(user.name, user.email)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{user.name || user.email}</p>
                  {user.name && user.email ? (
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{user.email}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  aria-label="Sign out"
                  title="Sign out"
                  className="btn btn-ghost btn-icon btn-sm shrink-0"
                >
                  <LogOut size={15} strokeWidth={1.75} aria-hidden />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-1" aria-hidden>
                <span className="skeleton h-9 w-9 rounded-full" />
                <span className="skeleton h-3 flex-1" />
              </div>
            )}
          </div>
        </div>
      </aside>

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
