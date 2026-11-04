'use client';

import { format } from 'date-fns';
import { ArrowUpRight, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONF_META, TopicTag } from './chips';
import type { Confidence } from './intervals';
import type { DailyItem } from './summary-state';

type RecallPromptProps = {
  revealed: boolean;
  onReveal: () => void;
  /** Shown next to the button, e.g. a "Space" key hint in focus mode. */
  hint?: React.ReactNode;
};

/** Step 1 of recall-first review: think it through before looking at the notes. */
export function RecallPrompt({ revealed, onReveal, hint }: RecallPromptProps) {
  if (revealed) return null;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      <p className="text-[14px] leading-relaxed text-foreground/85 sm:flex-1">
        Try to recall your approach first: the key idea, the data structure, the edge cases.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReveal();
          }}
          className="btn btn-primary btn-sm"
        >
          <Eye size={14} strokeWidth={1.75} aria-hidden /> Reveal notes
        </button>
        {hint}
      </div>
    </div>
  );
}

/** Step 2: the notes and history, shown after "Reveal notes". */
export function RecallDetails({ problem }: { problem: DailyItem }) {
  const tags: string[] = Array.isArray(problem.tags) ? problem.tags : [];
  const last = problem.lastRating && CONF_META[problem.lastRating as Confidence] ? CONF_META[problem.lastRating as Confidence] : null;
  const lastDate = problem.lastRevisedAt ? new Date(problem.lastRevisedAt) : null;
  const notes = typeof problem.notes === 'string' ? problem.notes.trim() : '';
  const reviews = problem.revisionCount ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          'max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-card px-4 py-3 text-[14px] leading-relaxed',
          notes ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {notes || 'No notes yet. Add some from the problems table so the next review has something to check against.'}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        <TopicTag topic={problem.topic} />
        {tags.map((t) => (
          <span key={t} className="chip h-5 px-2 text-[11px] normal-case tracking-normal">
            {t}
          </span>
        ))}
        <span>
          Reviewed {reviews} {reviews === 1 ? 'time' : 'times'}
        </span>
        {last && (
          <span>
            Last: <span className={cn('font-medium', last.text)}>{last.label}</span>
            {lastDate && !isNaN(lastDate.getTime()) ? ` on ${format(lastDate, 'MMM d')}` : ''}
          </span>
        )}
        {problem.url && (
          <a
            href={problem.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 normal-case tracking-normal text-foreground underline decoration-border-strong underline-offset-4 hover:text-ember"
          >
            Open problem <ArrowUpRight size={12} strokeWidth={1.75} aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}
