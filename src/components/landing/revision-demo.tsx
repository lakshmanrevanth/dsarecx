'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Eye, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LADDER_DAYS, QUEUE, difficultyChip, ratingOutcome, type QueueItem, type Rating } from './demo-data';

const RATINGS: { value: Rating; label: string; key: string }[] = [
  { value: 'struggled', label: 'Struggled', key: '1' },
  { value: 'shaky', label: 'Shaky', key: '2' },
  { value: 'clean', label: 'Clean', key: '3' },
];

const SHORTCUTS: [string, string][] = [
  ['j / k', 'move'],
  ['Space', 'reveal'],
  ['1 2 3', 'rate'],
  ['f', 'focus mode'],
  ['u', 'undo'],
];

// 15 weeks of made-up activity for the mini heatmap (deterministic).
const HEAT = Array.from({ length: 15 * 7 }, (_, i) => {
  const v = (Math.sin(i * 1.7) + Math.cos(i * 0.6) + 2) / 4;
  return i > 96 ? 0 : i % 11 === 5 ? 0 : Math.min(4, Math.floor(v * 5));
});

/**
 * The daily queue: expand an item, recall, reveal, rate. Rated items show when
 * they come back. Lists on every width; the side panel joins from lg up.
 */
export function RevisionDemo() {
  const [open, setOpen] = useState<string>(QUEUE[0].id);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [rated, setRated] = useState<Record<string, Rating>>({});
  const [lastRated, setLastRated] = useState<string | null>(null);

  const doneCount = Object.keys(rated).length;
  const streak = 12 + (doneCount === QUEUE.length ? 1 : 0);
  const pending = useMemo(() => QUEUE.filter((q) => !rated[q.id]), [rated]);

  function rate(item: QueueItem, r: Rating) {
    setRated((m) => ({ ...m, [item.id]: r }));
    setLastRated(item.id);
    const next = QUEUE.find((q) => q.id !== item.id && !rated[q.id]);
    setOpen(next?.id ?? '');
  }

  function undo() {
    if (!lastRated) return;
    setRated((m) => {
      const { [lastRated]: _removed, ...rest } = m;
      void _removed;
      return rest;
    });
    setOpen(lastRated);
    setLastRated(null);
  }

  function reset() {
    setRated({});
    setRevealed({});
    setOpen(QUEUE[0].id);
    setLastRated(null);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
    const idx = QUEUE.findIndex((q) => q.id === open);
    const item = QUEUE[idx];
    if (e.key === 'j' || e.key === 'k') {
      const list = pending.length ? pending : QUEUE;
      const at = Math.max(0, list.findIndex((q) => q.id === open));
      const next = list[(at + (e.key === 'j' ? 1 : list.length - 1)) % list.length];
      setOpen(next.id);
    } else if (e.key === ' ' && item && !rated[item.id]) {
      e.preventDefault();
      setRevealed((m) => ({ ...m, [item.id]: true }));
    } else if (['1', '2', '3'].includes(e.key) && item && !rated[item.id]) {
      rate(item, RATINGS[Number(e.key) - 1].value);
    } else if (e.key === 'u') {
      undo();
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]" onKeyDown={onKeyDown}>
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">Today&apos;s queue</p>
            <p className="mt-1 font-serif text-[28px] leading-none text-foreground">
              {doneCount === QUEUE.length ? (
                <>
                  All <em className="text-ember">done.</em>
                </>
              ) : (
                <>
                  {QUEUE.length - doneCount} of {QUEUE.length} left
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastRated ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={undo}>
                <RotateCcw size={13} aria-hidden /> Undo <span className="kbd">u</span>
              </button>
            ) : null}
            {doneCount === QUEUE.length ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={reset}>
                Run it again
              </button>
            ) : null}
          </div>
          <div
            className="h-1 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Daily goal"
            aria-valuemin={0}
            aria-valuemax={QUEUE.length}
            aria-valuenow={doneCount}
          >
            <div className="h-full rounded-full bg-ember transition-[width] duration-300" style={{ width: `${(doneCount / QUEUE.length) * 100}%` }} />
          </div>
        </div>

        <ul>
          {QUEUE.map((item) => {
            const isOpen = open === item.id;
            const r = rated[item.id];
            const panelId = `rev-panel-${item.id}`;
            return (
              <li key={item.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[hsl(16_100%_56%/0.04)]',
                    isOpen && 'bg-[hsl(16_100%_56%/0.05)]',
                  )}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? '' : item.id)}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                      r ? 'border-ember bg-ember text-[var(--ember-foreground)]' : 'border-border-strong',
                    )}
                  >
                    {r ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[15px] font-medium', r ? 'text-muted-foreground line-through decoration-border-strong' : 'text-foreground')}>
                      {item.title}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-faint">
                      {item.platform} · {item.topic}
                    </span>
                  </span>
                  <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                    {item.late && !r ? <span className="chip chip-warning">{item.late}d late</span> : null}
                    {item.difficulty ? (
                      <span className={cn('chip', difficultyChip(item.difficulty))}>{item.difficulty}</span>
                    ) : (
                      <span className="chip chip-ember">Concept</span>
                    )}
                  </span>
                  {r ? (
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {RATINGS.find((x) => x.value === r)?.label} · {ratingOutcome(item.step, r)}
                    </span>
                  ) : (
                    <ChevronDown size={16} aria-hidden className={cn('shrink-0 text-faint transition-transform', isOpen && 'rotate-180')} />
                  )}
                </button>

                {isOpen && !r ? (
                  <div id={panelId} className="px-5 pb-5 sm:pl-[52px]">
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ember-strong">
                      {item.platform === 'System design' ? 'Recall question' : 'Before you look'}
                    </p>
                    <p className="mt-1 text-[15px] text-foreground">{item.question}</p>

                    {revealed[item.id] ? (
                      <p className="mt-3 border-l-2 border-ember pl-3 text-[14px] leading-relaxed text-muted-foreground">{item.notes}</p>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm mt-3"
                        onClick={() => setRevealed((m) => ({ ...m, [item.id]: true }))}
                      >
                        <Eye size={14} aria-hidden /> Reveal notes <span className="kbd">Space</span>
                      </button>
                    )}

                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label={`Rate ${item.title}`}>
                      {RATINGS.map((x) => (
                        <button
                          key={x.value}
                          type="button"
                          onClick={() => rate(item, x.value)}
                          className={cn(
                            'flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors',
                            x.value === 'clean' ? 'border-ember/40 hover:bg-ember-soft' : 'border-border hover:border-border-strong hover:bg-muted',
                          )}
                        >
                          <span>
                            <span className="block text-[13.5px] font-medium text-foreground">{x.label}</span>
                            <span className="block font-mono text-[10.5px] text-muted-foreground">
                              back {ratingOutcome(item.step, x.value)}
                            </span>
                          </span>
                          <span className="kbd">{x.key}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="hidden flex-wrap gap-x-5 gap-y-2 border-t border-border px-5 py-3 sm:flex">
          {SHORTCUTS.map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <span className="kbd">{k}</span> {v}
            </span>
          ))}
        </div>
      </div>

      {/* Side panel: streak + heatmap */}
      <aside className="card hidden p-5 lg:block" aria-label="Streak and activity">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">Streak</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="display text-[64px] text-foreground">{streak}</span>
          <span className="text-[14px] text-muted-foreground">days</span>
          <span className="ember-dot ml-auto self-center" aria-hidden />
        </p>
        <p className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">Last 15 weeks</p>
        <div className="mt-3 grid grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label="Activity heatmap, most days active">
          {HEAT.map((v, i) => (
            <span
              key={i}
              className="aspect-square rounded-[2px]"
              style={{ background: `var(--heat-${i === HEAT.length - 8 && doneCount > 0 ? Math.min(4, doneCount + 1) : v})` }}
            />
          ))}
        </div>
        <div className="mt-6 border-t border-border pt-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">Ladder</p>
          <p className="mt-2 font-mono text-[13px] text-foreground">{LADDER_DAYS.join(' → ')} days</p>
        </div>
      </aside>
    </div>
  );
}
