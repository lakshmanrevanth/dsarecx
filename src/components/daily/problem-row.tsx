'use client';

import { useId, useRef, useState } from 'react';
import { AlarmClock, ArchiveX, ArrowUpRight, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DifficultyChip, ItemMark, LadderTicks, LateChip, RecheckChip, TopicTag } from './chips';
import { nextIntervalLabel, type Confidence } from './intervals';
import { RatingButtons } from './rating-buttons';
import { RecallDetails, RecallPrompt } from './recall-panel';
import { RecallQuestions } from './recall-questions';
import { RowMenu, type RowMenuItem } from './row-menu';
import type { DailyItem } from './summary-state';

export { nextIntervalLabel };

type ProblemRowProps = {
  problem: DailyItem;
  /** The user's review intervals, for the "next review" labels. */
  ladder?: readonly number[];
  /** Rating being saved for this row, if any. */
  pendingConf?: Confidence | null;
  /** Roving tabindex: only the focused row is in the tab order. */
  focused?: boolean;
  onRate: (problem: DailyItem, conf: Confidence) => void;
  onSnooze?: (problem: DailyItem, days: number) => void;
  onRetire?: (problem: DailyItem) => void;
  onFocusRow?: (id: string) => void;
};

const isInteractive = (el: EventTarget | null) =>
  !!(el as HTMLElement | null)?.closest?.('a, button, input, textarea, select, [role="menu"]');

const iconProps = { size: 14, strokeWidth: 1.75, 'aria-hidden': true } as const;

/**
 * One due item. Click (or Enter) expands the recall-first panel:
 * try to recall → reveal notes → rate with the pills (or 1/2/3).
 * Under 768px it becomes a stacked card with full-width rating buttons.
 */
export function ProblemRevisionRow({
  problem,
  ladder,
  pendingConf = null,
  focused = false,
  onRate,
  onSnooze,
  onRetire,
  onFocusRow,
}: ProblemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const panelId = useId();
  const rowRef = useRef<HTMLDivElement>(null);
  const saving = pendingConf !== null;
  const toggle = () => setExpanded((v) => !v);

  const menuItems: RowMenuItem[] = [
    { key: 's1', label: 'Snooze 1 day', icon: <AlarmClock {...iconProps} />, onSelect: () => onSnooze?.(problem, 1) },
    { key: 's3', label: 'Snooze 3 days', icon: <AlarmClock {...iconProps} />, onSelect: () => onSnooze?.(problem, 3) },
    { key: 's7', label: 'Snooze 1 week', icon: <AlarmClock {...iconProps} />, onSelect: () => onSnooze?.(problem, 7) },
    ...(problem.url
      ? [{ key: 'open', label: 'Open problem', icon: <ArrowUpRight {...iconProps} />, href: problem.url as string }]
      : []),
    { key: 'retire', label: 'Retire', icon: <ArchiveX {...iconProps} />, danger: true, separatorBefore: true, onSelect: () => onRetire?.(problem) },
  ];

  return (
    <div
      ref={rowRef}
      data-row-id={problem.id}
      role="group"
      aria-label={problem.title}
      tabIndex={focused ? 0 : -1}
      onFocus={() => onFocusRow?.(problem.id)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        } else if (e.key === 'Escape' && expanded) {
          setExpanded(false);
        }
      }}
      className={cn(
        'group/row relative border-b border-border last:border-b-0 transition-colors focus-visible:outline-offset-[-2px]',
        expanded ? 'bg-background/50' : 'hover:bg-[hsl(16_100%_56%/0.035)]',
      )}
    >
      {/* Ember rule marks the row with keyboard focus. */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-4 left-0 top-4 w-[2px] rounded-full bg-ember opacity-0 transition-opacity group-focus-within/row:opacity-100"
      />

      <div
        className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-4 px-4 py-4 [grid-template-areas:'title_more'_'rate_rate'] md:grid-cols-[minmax(0,1fr)_auto_auto] md:gap-x-5 md:px-6 md:py-5 md:[grid-template-areas:'title_rate_more']"
        onClick={(e) => {
          if (!isInteractive(e.target)) toggle();
        }}
      >
        {/* Title + metadata */}
        <div className="flex min-w-0 items-start gap-3 [grid-area:title]">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={expanded ? `Hide recall panel for ${problem.title}` : `Recall first: show notes panel for ${problem.title}`}
            title={expanded ? 'Hide' : 'Recall first, then reveal your notes'}
            onClick={toggle}
            className="btn btn-ghost btn-icon btn-sm -ml-1 mt-px shrink-0"
          >
            <ChevronRight
              size={15}
              strokeWidth={1.75}
              aria-hidden
              className={cn('transition-transform duration-150', expanded && 'rotate-90')}
            />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              <span
                title={problem.title}
                className="min-w-0 max-w-full truncate text-[15px] font-medium leading-snug text-foreground max-md:whitespace-normal"
              >
                {problem.title}
              </span>
              <RecheckChip show={problem.isRecheck} />
              <LateChip days={problem.daysOverdue} />
            </div>
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              <ItemMark problem={problem} size={16} />
              <DifficultyChip difficulty={problem.difficulty} />
              <TopicTag topic={problem.topic} className="max-w-[14rem]" />
              <LadderTicks step={problem.currentStep} mastered={problem.status === 'MASTERED'} />
            </div>
          </div>
        </div>

        {/* Rating */}
        <div className="[grid-area:rate]">
          <RatingButtons problem={problem} ladder={ladder} pendingConf={pendingConf} onRate={onRate} />
        </div>

        {/* Link + more */}
        <div className="flex items-center justify-end gap-0.5 self-start [grid-area:more] md:self-center">
          {problem.url && (
            <a
              href={problem.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open problem in new tab"
              aria-label={`Open ${problem.title} in a new tab`}
              className="btn btn-ghost btn-icon"
            >
              <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden />
            </a>
          )}
          {(onSnooze || onRetire) && <RowMenu items={menuItems} label={`More actions for ${problem.title}`} disabled={saving} />}
        </div>
      </div>

      {/* Recall-first panel: recall → reveal notes → rate */}
      {expanded && (
        <div id={panelId} className="px-4 pb-6 md:pl-[60px] md:pr-6">
          <ol className="flex flex-col gap-5 border-l border-border pl-4 md:pl-6">
            <li>
              <p className="eyebrow eyebrow-plain mb-3 text-[10px]">
                <span className="text-ember">(01)</span> Recall
              </p>
              {!revealed && <RecallQuestions problem={problem} />}
              <RecallPrompt
                revealed={revealed}
                onReveal={() => {
                  setRevealed(true);
                  // The button unmounts; keep focus on the row so 1/2/3 work straight away.
                  requestAnimationFrame(() => rowRef.current?.focus({ preventScroll: true }));
                }}
              />
              {revealed && <p className="text-[13px] text-muted-foreground">Done thinking it through. Now check yourself.</p>}
            </li>
            {revealed && (
              <>
                <li>
                  <p className="eyebrow eyebrow-plain mb-3 text-[10px]">
                    <span className="text-ember">(02)</span> Check your notes
                  </p>
                  <RecallDetails problem={problem} />
                </li>
                <li>
                  <p className="eyebrow eyebrow-plain mb-2 text-[10px]">
                    <span className="text-ember">(03)</span> Rate it
                  </p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    How did it go? Use the buttons above, or press <kbd className="kbd">1</kbd>{' '}
                    <kbd className="kbd">2</kbd> <kbd className="kbd">3</kbd>.
                  </p>
                </li>
              </>
            )}
          </ol>
        </div>
      )}
    </div>
  );
}
