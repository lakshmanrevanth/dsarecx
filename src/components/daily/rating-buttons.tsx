'use client';

import { cn } from '@/lib/utils';
import { CONF_META } from './chips';
import { CONFIDENCES, describeInterval, nextIntervalLabel, type Confidence } from './intervals';
import type { DailyItem } from './summary-state';

type RatingButtonsProps = {
  problem: DailyItem;
  ladder?: readonly number[] | null;
  pendingConf?: Confidence | null;
  onRate: (problem: DailyItem, conf: Confidence) => void;
  /** row: compact pills in a queue row. deck: large pills in focus mode. */
  size?: 'row' | 'deck';
  className?: string;
};

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** "Wed, Nov 18" for a label like "14d", so the hint names the actual day. */
function nextDateLabel(label: string, today = new Date()): string {
  const n = parseInt(label, 10);
  if (!Number.isFinite(n)) return '';
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Clean / Shaky / Struggled, each saying when the item comes back under the user's intervals. */
export function RatingButtons({ problem, ladder, pendingConf = null, onRate, size = 'row', className }: RatingButtonsProps) {
  const saving = pendingConf !== null;

  if (size === 'deck') {
    return (
      <div className={cn('grid grid-cols-1 gap-2.5 sm:grid-cols-3', className)}>
        {CONFIDENCES.map((conf, i) => {
          const meta = CONF_META[conf];
          const label = nextIntervalLabel(problem, conf, ladder);
          const next = describeInterval(label);
          const date = label === 'mastered' ? '' : nextDateLabel(label);
          return (
            <button
              key={conf}
              type="button"
              onClick={() => onRate(problem, conf)}
              disabled={saving}
              aria-keyshortcuts={String(i + 1)}
              aria-label={`${meta.label}${next ? `, ${next}` : ''}`}
              className={cn(
                'group flex min-h-[60px] items-center gap-3 rounded-full border border-border bg-card px-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[68px] sm:px-5',
                !saving && meta.hover,
              )}
            >
              <span className="kbd shrink-0">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[15px] font-medium text-foreground">
                  <span aria-hidden className={cn('h-2 w-2 rounded-full', meta.dot)} />
                  {pendingConf === conf ? 'Saving…' : meta.label}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                  {capitalize(next)}
                  {date ? ` · ${date}` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {CONFIDENCES.map((conf, i) => {
        const meta = CONF_META[conf];
        const next = nextIntervalLabel(problem, conf, ladder);
        return (
          <button
            key={conf}
            type="button"
            onClick={() => onRate(problem, conf)}
            disabled={saving}
            aria-keyshortcuts={String(i + 1)}
            aria-label={`Rate ${problem.title} as ${meta.label}${next ? `, ${next === 'mastered' ? 'marks it mastered' : `next review in ${next}`}` : ''}`}
            title={`${meta.hint}${next ? ` · ${describeInterval(next)}` : ''} (${i + 1})`}
            className={cn(
              'inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-[13px] font-medium text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60 md:h-9 md:flex-none',
              !saving && meta.hover,
            )}
          >
            <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
            <span>{pendingConf === conf ? 'Saving…' : meta.label}</span>
            {pendingConf !== conf && next && (
              <span className="font-mono text-[11px] text-muted-foreground">{next === 'mastered' ? '✓' : next}</span>
            )}
            {/* Key hint appears on the row that has keyboard focus. */}
            <span aria-hidden className="kbd ml-0.5 hidden h-[18px] min-w-[18px] text-[10px] md:group-focus-within/row:inline-grid">
              {i + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}
