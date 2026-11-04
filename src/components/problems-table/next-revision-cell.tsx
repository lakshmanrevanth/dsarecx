'use client';

// "Next review" cell: shows when the problem is due and lets the user move that date.
// Moving it logs no review and keeps the ladder step.

import { useId, useRef, useState } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { Popover } from '@/components/ui/dropdown-menu';
import { toLocalDateInput } from '@/lib/platforms/problem-input';
import { cn } from '@/lib/utils';

type ScheduledProblem = { status: string; nextRevisionAt?: string | Date | null };

const QUICK_PICKS: { label: string; days: number }[] = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'In 1 week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
  { label: 'In 1 month', days: 30 },
];

export type RevisionTone = 'none' | 'overdue' | 'today' | 'soon' | 'later';

export function describeNextRevision(problem: ScheduledProblem, now: Date = new Date()): { text: string; tone: RevisionTone } {
  if (problem.status === 'RETIRED' || !problem.nextRevisionAt) return { text: '—', tone: 'none' };
  const diff = Math.round((startOfDay(new Date(problem.nextRevisionAt)).getTime() - startOfDay(now).getTime()) / 86_400_000);
  const recheck = problem.status === 'MASTERED';
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, tone: 'overdue' };
  if (diff === 0) return { text: recheck ? 'Recheck today' : 'Due today', tone: 'today' };
  if (diff === 1) return { text: recheck ? 'Recheck tmrw' : 'Tomorrow', tone: 'soon' };
  return { text: `${recheck ? 'Recheck ' : ''}in ${diff}d`, tone: 'later' };
}

const TONE_CLASS: Record<RevisionTone, string> = {
  none: 'text-faint',
  overdue: 'text-error',
  today: 'text-ember-strong font-medium',
  soon: 'text-foreground',
  later: 'text-muted-foreground',
};

export function RevisionLabel({ problem, className }: { problem: ScheduledProblem; className?: string }) {
  const { text, tone } = describeNextRevision(problem);
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-xs tabular-nums', TONE_CLASS[tone], className)}>
      {(tone === 'overdue' || tone === 'today') && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {text}
    </span>
  );
}

export function NextRevisionCell({ problem, onSave }: { problem: ScheduledProblem; onSave: (nextRevisionOn: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const anchorRef = useRef<HTMLButtonElement>(null);
  const dateId = useId();
  const editable = problem.status !== 'RETIRED' && !!problem.nextRevisionAt;
  const today = toLocalDateInput();

  if (!editable) return <RevisionLabel problem={problem} />;
  const current = new Date(problem.nextRevisionAt as string | Date);

  const save = async (key: string) => {
    if (!key) return;
    if (key < today) {
      setError("Can't be in the past");
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(key);
      setOpen(false);
      anchorRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Next review ${format(current, 'MMM d, yyyy')}. Change date`}
        title={`${format(current, 'EEE, MMM d, yyyy')}. Click to move`}
        onClick={(e) => {
          e.stopPropagation();
          const cur = toLocalDateInput(current);
          setCustom(cur < today ? today : cur);
          setError('');
          setOpen((o) => !o);
        }}
        className="-mx-2 rounded-full px-2 py-1 transition-colors hover:bg-muted"
      >
        <RevisionLabel problem={problem} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} align="end" width={240} label="Move next review" arrowNav>
        <p className="px-2.5 pb-2 pt-1 text-[11.5px] leading-snug text-muted-foreground">
          Now <span className="font-mono text-foreground">{format(current, 'EEE, MMM d')}</span>. Moving it logs no review.
        </p>
        {QUICK_PICKS.map((q) => {
          const day = addDays(new Date(), q.days);
          return (
            <button
              key={q.label}
              type="button"
              data-menu-item=""
              tabIndex={-1}
              disabled={saving}
              onClick={() => save(toLocalDateInput(day))}
              className="menu-item justify-between"
            >
              <span>{q.label}</span>
              <span className="font-mono text-[11px] text-faint">{format(day, 'EEE MMM d')}</span>
            </button>
          );
        })}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(custom);
          }}
          className="mt-1.5 flex gap-1.5 border-t border-border px-1 pt-2"
        >
          <label className="sr-only" htmlFor={dateId}>
            Pick a date
          </label>
          <input
            id={dateId}
            type="date"
            value={custom}
            min={today}
            onChange={(e) => setCustom(e.target.value)}
            className="field h-8 min-w-0 flex-1 px-2 text-xs"
          />
          <button type="submit" disabled={saving || !custom} className="btn btn-primary btn-sm">
            {saving ? '…' : 'Set'}
          </button>
        </form>
        {error && (
          <p role="alert" className="px-2 pt-1.5 text-xs text-error">
            {error}
          </p>
        )}
      </Popover>
    </>
  );
}
