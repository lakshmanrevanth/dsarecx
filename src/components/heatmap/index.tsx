'use client';

import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';

// Local calendar date as YYYY-MM-DD. toISOString() would convert to UTC and
// shift the grid by a day for anyone not in UTC.
function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type ActivityEntry = { date: string; count: number };

type HeatmapProps = {
  activity: ActivityEntry[];
  /** Eyebrow section number, e.g. "04". */
  index?: string;
  className?: string;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Accessible name for a heatmap cell, e.g. "3 reviews on Nov 2, 2026". */
export function cellLabel(count: number, dateStr: string): string {
  return `${count === 0 ? 'No' : count} ${count === 1 ? 'review' : 'reviews'} on ${formatDate(dateStr)}`;
}

/** 0–4 intensity level for --heat-0..4. */
export function heatLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return localKey(new Date(y, m - 1, d + days));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS: Record<number, string> = { 1: 'Mon', 3: 'Wed', 5: 'Fri' };
const CELL = 11;
const GAP = 3;
const noopSubscribe = () => () => {};

type Hover = { date: string; count: number; x: number; y: number; below: boolean };

/** 53-week activity grid in local dates. Arrow keys move between days; each day has a spoken label. */
export function ContributionHeatmap({ activity, index = '04', className }: HeatmapProps) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  // Roving focus: one cell is in the tab order, arrow keys move between days.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const { weeks, monthLabels, todayStr, total, activeDays, maxStreak } = useMemo(() => {
    const today = new Date();
    const todayStr = localKey(today);
    const actMap: Record<string, number> = {};
    for (const entry of activity) actMap[entry.date] = (actMap[entry.date] ?? 0) + entry.count;

    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 52 * 7 - today.getDay());
    const weeks: { date: string; count: number }[][] = [];
    const monthLabels: { month: string; col: number }[] = [];
    const cur = new Date(start);
    let lastMonth = -1;
    let run = 0;
    let maxStreak = 0;
    let total = 0;
    let activeDays = 0;

    for (let w = 0; w < 53; w++) {
      const week: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = localKey(cur);
        const count = actMap[date] ?? 0;
        week.push({ date, count });
        if (date <= todayStr) {
          total += count;
          if (count > 0) {
            activeDays++;
            run++;
            maxStreak = Math.max(maxStreak, run);
          } else run = 0;
        }
        const m = cur.getMonth();
        if (d === 0 && m !== lastMonth) {
          // Skip a label squeezed into the first column when the month started mid-week.
          if (!(w === 0 && cur.getDate() > 21)) monthLabels.push({ month: MONTHS[m], col: w });
          lastMonth = m;
        }
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }
    return { weeks, monthLabels, todayStr, total, activeDays, maxStreak };
  }, [activity]);

  const firstKey = weeks[0]?.[0]?.date ?? todayStr;
  const focusKey = activeKey ?? todayStr;

  const showTip = (el: HTMLElement, date: string, count: number) => {
    const inner = innerRef.current;
    if (!inner) return;
    const a = el.getBoundingClientRect();
    const b = inner.getBoundingClientRect();
    const y = a.top - b.top;
    // Keep the tooltip inside the scroll area: flip below the top rows, clamp at the sides.
    const below = y < 48;
    const x = Math.max(90, Math.min(b.width - 90, a.left - b.left + a.width / 2));
    setHover({ date, count, x, y: below ? y + a.height + 8 : y - 8, below });
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const delta = ({ ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 } as Record<string, number>)[e.key];
    let next: string | null = null;
    if (delta !== undefined) next = shiftKey(focusKey, delta);
    else if (e.key === 'Home') next = firstKey;
    else if (e.key === 'End') next = todayStr;
    else if (e.key === 'Escape') {
      setHover(null);
      return;
    }
    if (!next) return;
    e.preventDefault();
    if (next < firstKey) next = firstKey;
    if (next > todayStr) next = todayStr;
    setActiveKey(next);
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${next}"]`)?.focus();
  };

  const figures = [
    { label: 'Active days', value: mounted ? activeDays : 0 },
    { label: 'Best streak', value: mounted ? maxStreak : 0 },
  ];

  return (
    <section data-heatmap-wrapper aria-labelledby="heatmap-title" className={cn('card px-5 py-6 md:px-8 md:py-7', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <p className="eyebrow">({index}) Activity</p>
          <h2 id="heatmap-title" className="mt-3 flex items-baseline gap-2 text-foreground">
            <span className="font-serif text-5xl leading-none">{mounted ? total : 0}</span>
            <span className="text-[14px] text-muted-foreground">reviews in the past year</span>
          </h2>
        </div>
        <dl className="flex gap-8">
          {figures.map((f) => (
            <div key={f.label}>
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">{f.label}</dt>
              <dd className="mt-1 font-serif text-3xl leading-none text-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {!mounted ? (
        <div className="skeleton mt-6 h-[124px] w-full" aria-hidden />
      ) : (
        <div data-heatmap-container className="-mx-1 mt-6 overflow-x-auto px-1 pb-1 pt-1">
          <div ref={innerRef} className="relative mx-auto w-fit" onPointerLeave={() => setHover(null)}>
            {/* Month labels */}
            <div className="mb-1.5 flex pl-8" aria-hidden>
              {weeks.map((_, wi) => {
                const label = monthLabels.find((m) => m.col === wi);
                return (
                  <div key={wi} className="shrink-0" style={{ width: CELL + GAP }}>
                    {label && <span className="font-mono text-[10.5px] text-muted-foreground">{label.month}</span>}
                  </div>
                );
              })}
            </div>

            <div className="flex">
              <div className="mr-1.5 flex w-[26px] shrink-0 flex-col" style={{ gap: GAP }} aria-hidden>
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <div key={d} className="flex items-center justify-end" style={{ height: CELL }}>
                    {DAY_LABELS[d] && <span className="font-mono text-[10px] text-muted-foreground">{DAY_LABELS[d]}</span>}
                  </div>
                ))}
              </div>

              <div
                ref={gridRef}
                role="group"
                aria-label="Reviews per day over the past year. Use the arrow keys to move between days."
                onKeyDown={onGridKeyDown}
                className="flex"
                style={{ gap: GAP }}
              >
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
                    {week.map((day) => {
                      const isToday = day.date === todayStr;
                      const isFuture = day.date > todayStr;
                      if (isFuture) return <div key={day.date} aria-hidden style={{ width: CELL, height: CELL }} />;
                      return (
                        <div
                          key={day.date}
                          role="img"
                          aria-label={cellLabel(day.count, day.date)}
                          tabIndex={day.date === focusKey ? 0 : -1}
                          data-date={day.date}
                          onFocus={(e) => {
                            setActiveKey(day.date);
                            showTip(e.currentTarget, day.date, day.count);
                          }}
                          onBlur={() => setHover(null)}
                          onPointerEnter={(e) => showTip(e.currentTarget, day.date, day.count)}
                          className={cn(
                            'shrink-0 rounded-[3px] transition-transform duration-100 hover:scale-125 focus-visible:outline-offset-1',
                            isToday && 'ring-1 ring-foreground ring-offset-1 ring-offset-card',
                          )}
                          style={{ width: CELL, height: CELL, background: `var(--heat-${heatLevel(day.count)})` }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-1.5" aria-hidden>
              <span className="mr-1 font-mono text-[10.5px] text-muted-foreground">Less</span>
              {[0, 1, 2, 3, 4].map((l) => (
                <span key={l} className="rounded-[3px]" style={{ width: CELL, height: CELL, background: `var(--heat-${l})` }} />
              ))}
              <span className="ml-1 font-mono text-[10.5px] text-muted-foreground">More</span>
            </div>

            {hover && (
              <div
                aria-hidden
                className={cn(
                  'pointer-events-none absolute z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-popover px-3 py-1.5 text-[12px] shadow-[var(--shadow-pop)]',
                  !hover.below && '-translate-y-full',
                )}
                style={{ left: hover.x, top: hover.y }}
              >
                <span className={cn('font-mono font-medium', hover.count > 0 ? 'text-ember' : 'text-muted-foreground')}>
                  {hover.count === 0 ? 'No' : hover.count} {hover.count === 1 ? 'review' : 'reviews'}
                </span>
                <span className="text-muted-foreground">on {formatDate(hover.date)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
