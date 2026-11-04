'use client';

// Today: the student's home. What I learned today, what I must revise today, and
// what I plan to learn next, for DSA problems and system design concepts.

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import useSWR, { useSWRConfig } from 'swr';
import { ArrowRight, Plus } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { PlatformLogo } from '@/lib/platforms/logos';
import { dateKeyInTz } from '@/lib/dates';
import type { StudyItemWithFlags } from '@/lib/study';
import { cn } from '@/lib/utils';
import { isCodingPlatform } from '@/components/today/learn';
import { difficultyChip } from '@/components/today/study-row';
import { ToLearn } from '@/components/today/to-learn';
import { ToastRegion, useToasts } from '@/components/today/toasts';
import type { LearnedEntry, TodayData } from '@/components/today/types';

const KEY = '/api/today';
const noopSubscribe = () => () => {};

function readDefaultPlatform() {
  try {
    const v = localStorage.getItem('dsarecx_default_platform') ?? localStorage.getItem('recall_default_platform');
    return isCodingPlatform(v) ? v : 'LEETCODE';
  } catch {
    return 'LEETCODE';
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function SectionHead({ index, title, aside, id }: { index: number; title: string; aside?: React.ReactNode; id: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="eyebrow">
        <span aria-hidden>({String(index).padStart(2, '0')})</span> {title}
      </h2>
      {aside}
    </div>
  );
}

function timeOf(entry: LearnedEntry, timezone: string) {
  // Logged today: the moment it was added. Otherwise the stored solve time.
  const created = new Date(entry.createdAt);
  const solved = new Date(entry.dateSolved);
  const at = dateKeyInTz(created, timezone) === dateKeyInTz(solved, timezone) ? created : solved;
  try {
    return at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone });
  } catch {
    return at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
}

function LearnedGroup({ title, entries, timezone, kind }: { title: string; entries: LearnedEntry[]; timezone: string; kind: 'dsa' | 'sd' }) {
  return (
    <div className="min-w-0">
      <h3 className="flex items-baseline gap-2 border-b border-border pb-2 text-[14px] font-medium text-foreground">
        {title}
        <span className="font-mono text-[11px] text-faint">{entries.length}</span>
      </h3>
      {entries.length === 0 ? (
        <p className="py-3 text-[13.5px] text-muted-foreground">{kind === 'dsa' ? 'No problems yet.' : 'No concepts yet.'}</p>
      ) : (
        <ul>
          {entries.map((e) => {
            const diff = difficultyChip(e.difficulty);
            const hasLink = e.url && e.url !== '#';
            return (
              <li key={e.id} className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
                <PlatformLogo platform={e.platform} size={16} />
                <div className="min-w-0 flex-1">
                  {hasLink ? (
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[14px] text-foreground hover:text-ember">
                      {e.title}
                    </a>
                  ) : (
                    <span className="block truncate text-[14px] text-foreground">{e.title}</span>
                  )}
                </div>
                {kind === 'dsa' && diff ? (
                  <span className={cn('chip h-5 shrink-0 px-2 text-[11px]', diff.chip)}>{diff.label}</span>
                ) : (
                  e.topic && <span className="chip hidden h-5 shrink-0 px-2 text-[11px] sm:inline-flex">{e.topic}</span>
                )}
                <span className="w-16 shrink-0 text-right font-mono text-[11px] text-faint">{timeOf(e, timezone)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="mt-10 space-y-10" aria-busy="true" aria-label="Loading today">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3 border-t border-border pt-8">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton h-4 w-3/5" />
          <div className="skeleton h-4 w-2/5" />
        </div>
      ))}
    </div>
  );
}

export default function TodayPage() {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const { mutate: globalMutate } = useSWRConfig();
  const { data, error, mutate, isLoading } = useSWR<TodayData>(hydrated ? KEY : null, fetcher, { revalidateOnFocus: true });
  const [defaultPlatform] = useState(() => (typeof window === 'undefined' ? 'LEETCODE' : readDefaultPlatform()));
  const { toasts, push, dismiss } = useToasts();

  const notify = useCallback(
    (message: string, opts?: { tone?: 'error'; action?: { label: string; onClick: () => void } }) => push({ message, ...opts }),
    [push]
  );

  const setItems = useCallback(
    (update: (items: StudyItemWithFlags[]) => StudyItemWithFlags[]) => {
      void mutate((d) => (d ? { ...d, toLearn: update(d.toLearn) } : d), { revalidate: false });
    },
    [mutate]
  );
  const refresh = useCallback(() => void mutate(), [mutate]);
  const onLearned = useCallback(() => {
    void mutate();
    // The new problem or concept shows up everywhere else too.
    void globalMutate((key: unknown) => typeof key === 'string' && /^\/api\/(problems|concepts|daily|streak|stats)/.test(key));
  }, [mutate, globalMutate]);

  const loaded = hydrated && data && typeof data === 'object' && 'toLearn' in data;
  const dateLabel = useMemo(() => {
    if (!loaded) return '';
    return new Date(`${data.today}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
  }, [loaded, data]);

  const learnedCount = loaded ? data.learned.dsa.length + data.learned.systemDesign.length : 0;

  return (
    <div>
      <header className="border-b border-border pb-8">
        <p className="eyebrow">
          Today{dateLabel && <span className="text-muted-foreground"> · {dateLabel}</span>}
        </p>
        <h1 className="display mt-4 text-5xl md:text-6xl">
          What did you <em>learn</em> today?
        </h1>
        <p className="mt-4 text-[15px] text-muted-foreground" aria-live="polite">
          {loaded
            ? `${learnedCount} learned · ${data.revisedCount} revised · ${data.due.count} due · ${data.toLearn.length} to learn`
            : ' '}
        </p>
        {loaded && (
          <p className="mt-3 inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
            <span className={cn('h-1.5 w-1.5 rounded-full', data.streak.currentStreak > 0 ? 'bg-ember' : 'bg-border-strong')} aria-hidden />
            {data.streak.currentStreak > 0 ? `${data.streak.currentStreak}-day streak` : 'No streak yet. Review one item to start'}
          </p>
        )}
      </header>

      {error && !loaded && (
        <div className="mt-10 flex flex-wrap items-center gap-3 text-[14px] text-error" role="alert">
          Couldn’t load today.
          <button type="button" className="btn btn-outline btn-sm" onClick={() => mutate()}>
            Try again
          </button>
        </div>
      )}
      {!loaded && !error && (isLoading || !hydrated) && <TodaySkeleton />}

      {loaded && (
        <div className="mt-10 space-y-12">
          {/* (01) Learned today */}
          <section aria-labelledby="learned-heading">
            <SectionHead index={1} id="learned-heading" title="Learned today" />
            {learnedCount === 0 ? (
              <div className="mt-4">
                <p className="text-[14.5px] text-muted-foreground">
                  Nothing logged yet. Add a problem or concept you studied today, or tick off one from your to-learn list below.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/dashboard" className="btn btn-outline btn-sm">
                    <Plus size={14} strokeWidth={1.75} aria-hidden /> Add a problem
                  </Link>
                  <Link href="/concepts" className="btn btn-outline btn-sm">
                    <Plus size={14} strokeWidth={1.75} aria-hidden /> Log a concept
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-8 md:grid-cols-2">
                <LearnedGroup title="DSA problems" entries={data.learned.dsa} timezone={data.timezone} kind="dsa" />
                <LearnedGroup title="System design" entries={data.learned.systemDesign} timezone={data.timezone} kind="sd" />
              </div>
            )}
          </section>

          {/* (02) Revise today */}
          <section aria-labelledby="revise-heading" className="border-t border-border pt-8">
            <SectionHead
              index={2}
              id="revise-heading"
              title="Revise today"
              aside={data.revisedCount > 0 && <span className="font-mono text-[11px] text-faint">{data.revisedCount} reviewed today</span>}
            />
            {data.due.count === 0 ? (
              <p className="mt-4 text-[14.5px] text-muted-foreground">
                <span className="font-medium text-foreground">All caught up.</span> Nothing is due for review today.
              </p>
            ) : (
              <div className="mt-4">
                <p className="text-[15px] text-foreground">
                  <span className="font-serif text-3xl text-ember">{data.due.count}</span>{' '}
                  {data.due.count === 1 ? 'item is' : 'items are'} due for review.
                </p>
                <ul className="mt-3">
                  {data.due.items.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
                      <PlatformLogo platform={p.platform} size={16} />
                      <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">{p.title}</span>
                      {p.isOverdue && (
                        <span className="chip chip-mono h-5 shrink-0 px-2 text-[10.5px]">{plural(p.daysOverdue, 'day')} late</span>
                      )}
                    </li>
                  ))}
                </ul>
                {data.due.count > data.due.items.length && (
                  <p className="mt-2 text-[13px] text-muted-foreground">and {data.due.count - data.due.items.length} more</p>
                )}
                <Link href="/daily" className="btn btn-ember mt-5">
                  Start review <ArrowRight size={15} strokeWidth={1.75} aria-hidden />
                </Link>
              </div>
            )}
          </section>

          {/* (03) To learn */}
          <section aria-labelledby="to-learn-heading" className="border-t border-border pt-8">
            <SectionHead
              index={3}
              id="to-learn-heading"
              title="To learn"
              aside={<span className="text-[13px] text-muted-foreground">What you plan to study next</span>}
            />
            <div className="mt-4">
              <ToLearn
                items={data.toLearn}
                today={data.today}
                defaultPlatform={defaultPlatform}
                setItems={setItems}
                refresh={refresh}
                onLearned={onLearned}
                notify={notify}
              />
            </div>
          </section>
        </div>
      )}

      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
