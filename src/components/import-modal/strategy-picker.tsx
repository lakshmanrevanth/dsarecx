'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Minus, Plus } from 'lucide-react';
import { MASTERY_RECHECK_DAYS } from '@/lib/scheduling';
import type { ImportStrategy } from '@/lib/import-utils';
import { cn } from '@/lib/utils';

type StrategyPickerStepProps = {
  strategy: ImportStrategy;
  onStrategyChange: (s: ImportStrategy) => void;
  dailyPace: number;
  onDailyPaceChange: (pace: number) => void;
  totalProblems: number;
  onContinue: () => void;
  onBack: () => void;
  /** The file carries status/step/next review (a backup or an exported CSV): offers "Keep schedule". */
  hasSchedule?: boolean;
  /** First interval of the user's ladder, in days. */
  firstIntervalDays?: number;
  isBusy?: boolean;
};

function PaceSelector({ pace, onChange, label }: { pace: number; onChange: (n: number) => void; label: string }) {
  return (
    <div
      className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-3 py-2.5"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <span className="text-[12.5px] text-muted-foreground">
        {label}: <span className="font-mono text-foreground">{pace}/day</span>
      </span>
      <div className="flex items-center gap-2">
        <div role="group" aria-label={`${label} presets`} className="flex gap-1">
          {[2, 3, 5, 10, 15].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={pace === n}
              aria-label={`${n} per day`}
              onClick={() => onChange(n)}
              className={cn(
                'h-7 min-w-7 rounded-full border px-2 font-mono text-[11.5px] transition-colors',
                pace === n ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:border-border-strong'
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex items-center rounded-full border border-border bg-card">
          <button type="button" aria-label="Fewer per day" disabled={pace <= 1} onClick={() => onChange(Math.max(1, pace - 1))} className="inline-grid size-7 place-items-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40">
            <Minus size={12} aria-hidden />
          </button>
          <span aria-live="polite" className="min-w-6 text-center font-mono text-[11.5px] text-foreground">
            {pace}
          </span>
          <button type="button" aria-label="More per day" disabled={pace >= 100} onClick={() => onChange(Math.min(100, pace + 1))} className="inline-grid size-7 place-items-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40">
            <Plus size={12} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function StrategyCard({
  value,
  selected,
  title,
  badge,
  children,
  extra,
  onSelect,
  onArrow,
}: {
  value: ImportStrategy;
  selected: boolean;
  title: string;
  badge?: string;
  children: ReactNode;
  extra?: ReactNode;
  onSelect: (v: ImportStrategy) => void;
  onArrow: (e: KeyboardEvent<HTMLDivElement>, v: ImportStrategy) => void;
}) {
  const id = `strategy-${value}`;
  return (
    <div
      id={id}
      role="radio"
      aria-checked={selected}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-desc`}
      tabIndex={selected ? 0 : -1}
      onClick={() => onSelect(value)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onSelect(value);
        } else onArrow(e, value);
      }}
      className={cn(
        'flex cursor-pointer gap-3.5 rounded-xl border p-4 transition-colors',
        selected ? 'border-ember/50 bg-ember-soft/60' : 'border-border bg-card hover:border-border-strong'
      )}
    >
      <span aria-hidden className={cn('mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border', selected ? 'border-ember' : 'border-border-strong')}>
        {selected && <span className="size-2 rounded-full bg-ember" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span id={`${id}-title`} className="text-[14.5px] font-medium text-foreground">
            {title}
          </span>
          {badge && <span className="chip chip-mono chip-ember h-5 px-2 text-[9.5px]">{badge}</span>}
        </div>
        <p id={`${id}-desc`} className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {children}
        </p>
        {selected && extra}
      </div>
    </div>
  );
}

export function StrategyPickerStep({
  strategy,
  onStrategyChange,
  dailyPace,
  onDailyPaceChange,
  totalProblems,
  onContinue,
  onBack,
  hasSchedule = false,
  firstIntervalDays = 3,
  isBusy = false,
}: StrategyPickerStepProps) {
  const pace = Math.max(1, dailyPace || 1);
  const days = Math.max(1, Math.ceil(totalProblems / pace));
  const strong = 'font-medium text-foreground';
  const options: ImportStrategy[] = [...(hasSchedule ? (['preserve'] as const) : []), 'staggered', 'fresh', 'archive'];

  const onArrow = (e: KeyboardEvent<HTMLDivElement>, current: ImportStrategy) => {
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = options[(options.indexOf(current) + delta + options.length) % options.length];
    onStrategyChange(next);
    document.getElementById(`strategy-${next}`)?.focus();
  };
  const card = (value: ImportStrategy) => ({ value, selected: strategy === value, onSelect: onStrategyChange, onArrow });

  return (
    <div className="flex flex-col gap-5">
      <p id="strategy-heading" className="text-[14px] text-muted-foreground">
        How should these <span className={strong}>{totalProblems.toLocaleString()}</span> problems enter your review schedule?
      </p>
      <div role="radiogroup" aria-labelledby="strategy-heading" className="flex flex-col gap-2.5">
        {hasSchedule && (
          <StrategyCard {...card('preserve')} title="Keep the schedule from the file" badge="Restore">
            Each problem keeps its <span className={strong}>status, ladder step and next review date</span>. Rows without schedule data start fresh.
          </StrategyCard>
        )}
        <StrategyCard
          {...card('staggered')}
          title="Spread them out"
          badge={hasSchedule ? undefined : 'Recommended'}
          extra={<PaceSelector pace={pace} onChange={onDailyPaceChange} label="Daily pace" />}
        >
          First reviews are spread over the next <span className={strong}>~{days} {days === 1 ? 'day' : 'days'}</span>, about {pace} a day, instead of all at once.
        </StrategyCard>
        <StrategyCard {...card('fresh')} title="Start fresh">
          Each problem starts at step 0, first review{' '}
          <span className={strong}>
            {firstIntervalDays} {firstIntervalDays === 1 ? 'day' : 'days'} after its solve date
          </span>
          . Problems solved long ago are due right away.
        </StrategyCard>
        <StrategyCard {...card('archive')} title="No reviews for now" extra={<PaceSelector pace={pace} onChange={onDailyPaceChange} label="Rechecks per day" />}>
          Imported as <span className={strong}>Mastered</span>, out of daily reviews. Each comes back once for a recheck from {MASTERY_RECHECK_DAYS} days, about {pace} a
          day.
        </StrategyCard>
      </div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} disabled={isBusy} className="btn btn-outline">
          <ArrowLeft size={15} aria-hidden /> Back
        </button>
        <button type="button" onClick={onContinue} disabled={isBusy} aria-busy={isBusy} className="btn btn-primary">
          {isBusy ? (
            <>
              <Loader2 size={15} className="animate-spin" aria-hidden /> Checking rows…
            </>
          ) : (
            <>
              Review <ArrowRight size={15} aria-hidden />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
