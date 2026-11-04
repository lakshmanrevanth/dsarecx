'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useSyncExternalStore } from 'react';
import { ArrowRight, RotateCw } from 'lucide-react';
import type { StatsPayload } from '@/app/api/stats/compute';
import { fetcher } from '@/lib/fetcher';
import { StatsCard } from '@/components/stats/stats-card';
import { KpiTiles } from '@/components/stats/kpi-tiles';
import { RecallChart } from '@/components/stats/recall-chart';
import { UpcomingChart } from '@/components/stats/upcoming-chart';
import { WeakTopics } from '@/components/stats/weak-topics';
import { LadderChart } from '@/components/stats/ladder-chart';
import { KindCompare } from '@/components/stats/kind-compare';

const noopSubscribe = () => () => {};

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading stats" className="flex flex-col gap-6">
      <div className="card grid grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 px-6 py-6">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-10 w-20" />
            <div className="skeleton h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card h-[340px] space-y-4 p-7">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-7 w-48" />
            <div className="skeleton mt-6 h-[200px] w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function StatsPage() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<StatsPayload | null>('/api/stats', fetcher);
  // SWR's cache is persisted to localStorage, so the browser's first render may already
  // have data the server didn't. Only render data after hydration to avoid a mismatch.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const stats = hydrated && data && Array.isArray(data.recallRate) ? data : null;

  let body: React.ReactNode;
  if (!hydrated || (!stats && isLoading)) {
    body = <Skeleton />;
  } else if (!stats && error) {
    body = (
      <div role="alert" className="card border-error-border px-6 py-12 text-center">
        <p className="eyebrow justify-center text-error">Couldn&apos;t load</p>
        <p className="mt-4 text-[15px] text-foreground">Couldn&apos;t load your stats.</p>
        <button type="button" onClick={() => mutate()} disabled={isValidating} className="btn btn-outline mt-6">
          <RotateCw size={14} strokeWidth={1.75} aria-hidden className={isValidating ? 'animate-spin' : ''} />
          {isValidating ? 'Retrying…' : 'Try again'}
        </button>
      </div>
    );
  } else if (!stats) {
    body = <Skeleton />;
  } else {
    const items = stats.totals.active + stats.totals.mastered + stats.totals.retired;
    const hasReviews = stats.totals.reviewsAllTime > 0;
    const upcomingTotal = stats.upcoming.reduce((n, d) => n + d.count, 0);

    const upcomingCard = (index: string) => (
      <StatsCard
        id="stats-upcoming"
        index={index}
        kicker="Ahead"
        title="Upcoming reviews"
        subtitle={
          upcomingTotal
            ? `Next 30 days · ${plural(upcomingTotal, 'review')} scheduled${stats.overdueCount ? ` · ${stats.overdueCount} overdue counted on today` : ''}`
            : 'Nothing scheduled in the next 30 days'
        }
      >
        <UpcomingChart days={stats.upcoming} overdueCount={stats.overdueCount} />
      </StatsCard>
    );
    const ladderCard = (index: string) => (
      <StatsCard id="stats-ladder" index={index} kicker="Ladder" title="Where your items sit" subtitle="Active items by review step, plus mastered items">
        <LadderChart steps={stats.ladder.steps} mastered={stats.ladder.mastered} ladderDays={stats.ladderDays} />
      </StatsCard>
    );

    body = (
      <div className="flex flex-col gap-6">
        {error && (
          <div role="status" className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
            Showing saved stats; the latest couldn&apos;t load.
            <button type="button" onClick={() => mutate()} className="btn btn-outline btn-sm">
              Retry
            </button>
          </div>
        )}
        {!hasReviews ? (
          <>
            <div className="card px-6 py-12 text-center md:py-16">
              <p className="eyebrow justify-center">No reviews yet</p>
              <h2 className="display mt-5 text-4xl text-foreground md:text-5xl">
                Your numbers start <em>here.</em>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                {items
                  ? `You're tracking ${plural(items, 'item')}. Rate your first reviews to see your recall rate and weak spots.`
                  : 'Add a problem or a concept to get started.'}
              </p>
              <Link href={items ? '/daily' : '/dashboard'} className="btn btn-primary mt-8">
                {items ? 'Go to the daily queue' : 'Go to the dashboard'}
                <ArrowRight size={15} strokeWidth={1.75} aria-hidden />
              </Link>
            </div>
            {items > 0 && (
              <div className="grid gap-6 lg:grid-cols-2">
                {upcomingCard('02')}
                {ladderCard('03')}
              </div>
            )}
          </>
        ) : (
          <>
            <KpiTiles stats={stats} />
            <div className="grid gap-6 lg:grid-cols-2">
              <StatsCard
                id="stats-recall"
                index="02"
                kicker="Recall"
                title="Recall rate by week"
                subtitle="Share of reviews rated clean, per week (Mon–Sun), last 12 weeks"
              >
                <RecallChart weeks={stats.recallRate} />
              </StatsCard>
              {upcomingCard('03')}
              <StatsCard
                id="stats-weak"
                index="04"
                kicker="Weak spots"
                title="Weakest topics"
                subtitle="Last 90 days, by share of struggled reviews (shaky counts half). At least 3 reviews."
              >
                <WeakTopics topics={stats.weakestTopics} />
              </StatsCard>
              <div className="flex min-w-0 flex-col gap-6">
                {ladderCard('05')}
                <StatsCard id="stats-kinds" index="06" kicker="Compare" title="Problems vs concepts" subtitle="Last 90 days">
                  <KindCompare problems={stats.byKind.problems} concepts={stats.byKind.concepts} />
                </StatsCard>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="pb-8">
      <header className="mb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">(01) Stats</p>
          {stats && (
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Days in {stats.timeZone.replace(/_/g, ' ')}
            </p>
          )}
        </div>
        <h1 className="display mt-5 text-5xl text-foreground md:text-6xl">
          Memory, <em>measured.</em>
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          How cleanly you recall, what&apos;s coming up, and which topics need another pass.
        </p>
      </header>
      {body}
    </div>
  );
}
