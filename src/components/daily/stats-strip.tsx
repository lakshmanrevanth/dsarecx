'use client';

import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';

type StatsStripProps = {
  streak: number;
  totalProblems: number;
  masteredCount: number;
  dueCount: number;
  overdueCount?: number;
  todayCompleted?: boolean;
  /** How a day counts toward the streak, e.g. "a day counts when you review 5". */
  streakRule?: string;
};

const noopSubscribe = () => () => {};

/** Streak plus due / total / mastered, as one ruled strip of figures. */
export function StatsStrip({
  streak,
  totalProblems,
  masteredCount,
  dueCount,
  overdueCount = 0,
  todayCompleted = false,
  streakRule,
}: StatsStripProps) {
  // Numbers come from a localStorage-backed cache, so only show them after hydration.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const v = (n: number) => (mounted ? n : 0);
  const lit = mounted && (streak > 0 || todayCompleted);

  const figures = [
    { label: 'Due today', value: v(dueCount), note: overdueCount > 0 && mounted ? `${overdueCount} overdue` : null, accent: dueCount > 0 },
    { label: 'Tracked', value: v(totalProblems), note: null, accent: false },
    { label: 'Mastered', value: v(masteredCount), note: null, accent: false },
  ];

  return (
    <dl data-stats-strip className="grid grid-cols-2 border-y border-border md:grid-cols-[1.4fr_1fr_1fr_1fr]">
      <div className="col-span-2 flex flex-col justify-center gap-1 border-b border-border py-5 pr-4 md:col-span-1 md:border-b-0 md:border-r">
        <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Streak</dt>
        <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={cn('font-serif text-5xl leading-none', lit ? 'text-foreground' : 'text-faint')}>{v(streak)}</span>
          <span className="text-[14px] text-muted-foreground">day streak</span>
          {lit && <span aria-hidden className="ember-dot ml-1 h-1.5 w-1.5 self-center" />}
        </dd>
        {streakRule && <dd className="text-[12.5px] text-muted-foreground">{streakRule}</dd>}
      </div>
      {figures.map((f, i) => (
        <div
          key={f.label}
          className={cn(
            'flex flex-col justify-center gap-1 py-5 md:px-6',
            i === 0 && 'border-r border-border pr-4 md:pr-6',
            i === 1 && 'pl-4 md:border-r md:border-border',
            i === 2 && 'col-span-2 border-t border-border md:col-span-1 md:border-t-0',
          )}
        >
          <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{f.label}</dt>
          <dd className="flex items-baseline gap-2">
            <span className={cn('font-serif text-4xl leading-none', f.accent && mounted ? 'text-ember' : 'text-foreground')}>{f.value}</span>
            {f.note && <span className="font-mono text-[11px] text-muted-foreground">{f.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Today's reviews against the daily goal. */
export function GoalProgress({ reviewed, goal }: { reviewed: number; goal: number }) {
  const safeGoal = Math.max(1, goal);
  const met = reviewed >= safeGoal;
  const pctDone = Math.min(100, (reviewed / safeGoal) * 100);
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
      <div
        role="progressbar"
        aria-label="Daily goal"
        aria-valuemin={0}
        aria-valuemax={safeGoal}
        aria-valuenow={Math.min(reviewed, safeGoal)}
        className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', met ? 'bg-success' : 'bg-ember')}
          style={{ width: `${pctDone}%` }}
        />
      </div>
      <span className="font-mono text-[12px] text-muted-foreground">
        <span className="text-foreground">{reviewed}</span> / {safeGoal} reviewed today
        {met ? <span className="text-success"> · goal met</span> : ''}
      </span>
    </div>
  );
}
