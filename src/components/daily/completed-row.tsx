'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONF_META, DifficultyChip, ItemMark, TopicTag } from './chips';
import type { DailyItem } from './summary-state';

type Confidence = 'CLEAN' | 'SHAKY' | 'STRUGGLED';
const CONFS: Confidence[] = ['CLEAN', 'SHAKY', 'STRUGGLED'];

export type ProblemCompletedItem = DailyItem;

type CompletedRowProps = {
  problem: ProblemCompletedItem;
  onUndo: (id: string) => Promise<void>;
  onChangeConfidence: (id: string, conf: Confidence) => Promise<void>;
};

/** A rating made today: change it (Clean / Shaky / Struggled) or undo it. */
export function CompletedRow({ problem, onUndo, onChangeConfidence }: CompletedRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [optimisticConf, setOptimisticConf] = useState<Confidence | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const serverConf: Confidence = problem.latestRevision?.confidence ?? 'CLEAN';
  // Server data wins once it arrives (reset during render, not in an effect).
  const [seenServerConf, setSeenServerConf] = useState(serverConf);
  if (seenServerConf !== serverConf) {
    setSeenServerConf(serverConf);
    setOptimisticConf(null);
  }

  const currentConf: Confidence = optimisticConf ?? serverConf;
  const meta = CONF_META[currentConf] ?? CONF_META.CLEAN;
  const busy = isUndoing || isUpdating;

  useEffect(() => {
    if (!menuOpen) return;
    itemRefs.current[CONFS.indexOf(currentConf)]?.focus();
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // Focus the checked item only when the menu opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  const closeMenu = (refocus = true) => {
    setMenuOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const handleUndo = async () => {
    if (busy) return;
    setIsUndoing(true);
    try {
      await onUndo(problem.id);
    } finally {
      setIsUndoing(false);
    }
  };

  const select = async (next: Confidence) => {
    closeMenu();
    if (next === currentConf || busy) return;
    const previous = currentConf;
    setOptimisticConf(next);
    setIsUpdating(true);
    try {
      await onChangeConfidence(problem.id, next);
    } catch {
      setOptimisticConf(previous);
    } finally {
      setIsUpdating(false);
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    const i = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const d = e.key === 'ArrowDown' ? 1 : -1;
      itemRefs.current[(i + d + CONFS.length) % CONFS.length]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
    } else if (e.key === 'Tab') setMenuOpen(false);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-b border-border px-4 py-4 last:border-b-0 [grid-template-areas:'title_link'_'rate_rate'] md:grid-cols-[minmax(0,1fr)_auto_auto] md:gap-x-5 md:px-6 md:[grid-template-areas:'title_rate_link']">
      <div className="flex min-w-0 items-start gap-3 [grid-area:title]">
        <span aria-hidden className={cn('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border', meta.chip)}>
          <Check size={12} strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          {problem.url ? (
            <a
              href={problem.url}
              target="_blank"
              rel="noopener noreferrer"
              title={problem.title}
              className="block truncate text-[14.5px] font-medium text-foreground/80 decoration-border-strong underline-offset-4 hover:text-foreground hover:underline"
            >
              {problem.title}
            </a>
          ) : (
            <span title={problem.title} className="block truncate text-[14.5px] font-medium text-foreground/80">
              {problem.title}
            </span>
          )}
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            <ItemMark problem={problem} size={15} />
            <DifficultyChip difficulty={problem.difficulty} />
            <TopicTag topic={problem.topic} className="max-w-[12rem]" />
          </div>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative flex items-center gap-1.5 [grid-area:rate]"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && menuOpen) {
            e.stopPropagation();
            closeMenu();
          }
        }}
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && !menuOpen) {
              e.preventDefault();
              setMenuOpen(true);
            }
          }}
          disabled={busy}
          title="Change the rating"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          aria-label={`Rated ${meta.label}. Change rating for ${problem.title}`}
          className={cn('chip h-8 cursor-pointer gap-1.5 px-3 text-[13px] transition-[filter] hover:brightness-95 disabled:cursor-not-allowed', meta.chip)}
        >
          <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
          <span>{meta.label}</span>
          <ChevronDown size={13} strokeWidth={1.75} aria-hidden className="opacity-70" />
        </button>

        {menuOpen && (
          <div
            id={menuId}
            role="menu"
            aria-label="Change rating"
            onKeyDown={onMenuKeyDown}
            className="menu absolute left-0 top-[calc(100%+6px)] z-50"
          >
            <p className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint" role="presentation">
              Change rating
            </p>
            {CONFS.map((c, i) => {
              const m = CONF_META[c];
              const checked = c === currentConf;
              return (
                <button
                  key={c}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  tabIndex={-1}
                  onClick={() => select(c)}
                  className={cn('menu-item justify-between', checked && 'font-medium')}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
                    {m.label}
                  </span>
                  {checked && <Check size={13} strokeWidth={2} aria-hidden />}
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={handleUndo}
          disabled={busy}
          title="Undo this rating (puts it back in the queue)"
          aria-label={`Undo rating for ${problem.title}`}
          className="btn btn-ghost btn-sm"
        >
          <RotateCcw size={13} strokeWidth={1.75} aria-hidden className={isUndoing ? 'animate-spin' : ''} />
          <span>{isUndoing ? 'Undoing…' : 'Undo'}</span>
        </button>
      </div>

      <div className="flex justify-end self-start [grid-area:link] md:self-center">
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
      </div>
    </div>
  );
}
