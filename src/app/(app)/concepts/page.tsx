'use client';

// System Design: work through reading paths one article at a time, or log any
// concept you learned. Everything logged here is reviewed on the same spaced
// repetition ladder as coding problems (in the Daily queue) and shows up on the
// Today page.

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import useSWR, { useSWRConfig } from 'swr';
import { format } from 'date-fns';
import { fetcher } from '@/lib/fetcher';
import { cn } from '@/lib/utils';
import { LearningPaths } from './learning-paths';
import { ConceptLog } from './concept-log';
import { isDue, localDateKey, noopSubscribe, type TrackedConcept } from './shared';

type View = 'paths' | 'library';

const TABS: { key: View; label: string }[] = [
  { key: 'paths', label: 'Learning paths' },
  { key: 'library', label: 'Library & log' },
];

export default function ConceptsPage() {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading, mutate: reload } = useSWR<TrackedConcept[]>('/api/concepts', fetcher);
  // The SWR cache may be persisted in the browser, so the first client render can already
  // hold data the server didn't render. Use it only after hydration.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const tracked = useMemo(() => (hydrated && Array.isArray(data) ? data : []), [hydrated, data]);
  const loaded = hydrated && Array.isArray(data);

  const [view, setView] = useState<View>('paths');
  const tabRefs = useRef<Record<View, HTMLButtonElement | null>>({ paths: null, library: null });

  /** Refresh every view that shows concepts after one is added. */
  const refreshAll = useCallback(() => {
    void reload();
    void mutate('/api/problems');
    void mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/daily'));
    void mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/problems/due'));
  }, [reload, mutate]);

  const todayKey = localDateKey();
  const learnedToday = tracked.filter((c) => localDateKey(new Date(c.dateSolved)) === todayKey).length;
  const dueNow = tracked.filter(isDue).length;
  const mastered = tracked.filter((c) => c.status === 'MASTERED').length;

  const stats = [
    { label: 'Tracked', value: tracked.length },
    { label: 'Learned today', value: learnedToday },
    { label: 'Due for review', value: dueNow, accent: dueNow > 0 },
    { label: 'Mastered', value: mastered },
  ];

  const onTabKey = (e: React.KeyboardEvent, current: View) => {
    const i = TABS.findIndex((t) => t.key === current);
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    const key = TABS[next].key;
    setView(key);
    tabRefs.current[key]?.focus();
  };

  return (
    <div className="w-full pb-16">
      {/* Header */}
      <header className="border-b border-border pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Concepts &amp; paths</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint" suppressHydrationWarning>
            {hydrated ? format(new Date(), 'EEEE, MMM d') : ' '}
          </p>
        </div>
        <h1 className="display mt-4 text-5xl md:text-6xl">
          System <em>design.</em>
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Work through a reading path or log any concept you learned. Each one comes back in your{' '}
          <Link href="/daily" className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-ember">
            Daily queue
          </Link>{' '}
          on your review intervals, then once more after 90 days.
        </p>

        {/* Stats strip */}
        <dl className="mt-8 grid grid-cols-2 gap-y-5 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                'flex flex-col gap-1 border-border pr-4',
                i % 2 === 1 && 'border-l pl-5',
                i === 2 && 'sm:border-l sm:pl-5'
              )}
            >
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{s.label}</dt>
              <dd className={cn('display text-4xl tabular-nums', s.accent && 'text-ember')}>
                {loaded ? s.value : <span className="skeleton inline-block h-8 w-10 align-middle" aria-hidden />}
                {!loaded && <span className="sr-only">Loading</span>}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="System design views" className="inline-flex rounded-full border border-border bg-card p-1">
          {TABS.map((t) => {
            const active = view === t.key;
            return (
              <button
                key={t.key}
                ref={(el) => {
                  tabRefs.current[t.key] = el;
                }}
                id={`tab-${t.key}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${t.key}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setView(t.key)}
                onKeyDown={(e) => onTabKey(e, t.key)}
                className={cn(
                  'h-8 rounded-full px-4 text-[13px] font-medium transition-colors duration-150',
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {dueNow > 0 && (
          <Link href="/daily" className="btn btn-outline btn-sm">
            <span className="ember-dot" aria-hidden /> Review {dueNow} due now
          </Link>
        )}
      </div>

      {error && !data && (
        <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-error-border bg-error-bg px-4 py-3 text-sm text-error">
          Couldn&apos;t load your concepts.
          <button type="button" className="btn btn-outline btn-sm" onClick={() => reload()}>
            Try again
          </button>
        </div>
      )}

      <div id={`panel-${view}`} role="tabpanel" aria-labelledby={`tab-${view}`} className="mt-8">
        {view === 'paths' ? (
          <LearningPaths tracked={tracked} loading={!loaded && !error} onLearned={refreshAll} />
        ) : (
          <ConceptLog
            tracked={tracked}
            loading={(isLoading || !hydrated) && !data}
            failed={!!error && !data}
            onSaved={refreshAll}
          />
        )}
      </div>
    </div>
  );
}
