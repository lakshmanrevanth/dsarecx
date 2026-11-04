'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Bookmark, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 'all' | 'due' | 'bookmarked' | `list:<id>` */
export type TabKey = string;

type Tab = { key: TabKey; label: string; icon?: ReactNode; count?: number; accent?: boolean };

export function TabBar({
  activeTab,
  onChange,
  lists = [],
  dueCount,
  totalCount,
  trailing,
}: {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
  lists?: { id: string; name: string; count: number }[];
  dueCount?: number;
  totalCount?: number;
  /** Rendered after the tabs (e.g. the Lists menu). */
  trailing?: ReactNode;
}) {
  const tabs: Tab[] = [
    { key: 'all', label: 'All problems', count: totalCount },
    { key: 'due', label: 'Due today', count: dueCount, accent: true },
    { key: 'bookmarked', label: 'Bookmarked', icon: <Bookmark size={13} aria-hidden fill={activeTab === 'bookmarked' ? 'currentColor' : 'none'} /> },
    ...lists.map((l) => ({ key: `list:${l.id}`, label: l.name, icon: <ListChecks size={13} aria-hidden />, count: l.count })),
  ];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = Math.max(0, tabs.findIndex((t) => t.key === activeTab));

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(tabs[next].key);
  };

  return (
    <div className="flex items-end border-b border-border">
      <div
        role="tablist"
        aria-label="Problem views"
        className="-mb-px flex min-w-0 flex-1 items-end gap-5 overflow-x-auto [scrollbar-width:none] sm:gap-7 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab, i) => {
          const on = i === active;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(tab.key)}
              onKeyDown={(e) => onKeyDown(e, i)}
              title={tab.label}
              className={cn(
                'relative flex max-w-[220px] shrink-0 items-center gap-2 whitespace-nowrap border-b-2 pb-3 pt-1 text-[14px] transition-colors',
                on ? 'border-ember font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.icon}
              {tab.key === 'bookmarked' ? <span className="sr-only sm:not-sr-only">{tab.label}</span> : <span className="truncate">{tab.label}</span>}
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  aria-label={`${tab.count} problems`}
                  className={cn(
                    'rounded-full px-1.5 font-mono text-[10.5px] leading-[18px] tabular-nums',
                    tab.accent ? 'bg-ember-soft text-ember-strong' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {trailing && <div className="shrink-0 pb-1.5 pl-3">{trailing}</div>}
    </div>
  );
}
