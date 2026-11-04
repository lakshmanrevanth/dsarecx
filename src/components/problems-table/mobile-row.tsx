'use client';

// Phone layout for one problem. Tap opens the editor (or toggles selection while
// selecting); long-press starts selecting; the arrow opens the problem itself.

import { memo, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { CustomCheckbox } from '@/components/ui/custom-checkbox';
import { TopicPill } from '@/components/ui/pill';
import { PlatformLogo } from '@/lib/platforms/logos';
import { displayCode } from '@/lib/platforms/problem-input';
import { cn } from '@/lib/utils';
import { StarButton } from './cells';
import { RevisionLabel } from './next-revision-cell';
import { ProblemEditor, type ProblemPatch } from './problem-editor';
import { DifficultyChip, StatusBadge, problemIdentifier, type Json } from './shared';

type MobileRowProps = {
  problem: Json;
  isSelected?: boolean;
  /** While any row is selected, a tap toggles selection instead of opening the editor. */
  selectionMode?: boolean;
  isHighlighted?: boolean;
  onToggleSelect?: (id: string) => void;
  onStarToggle: (id: string, current: boolean) => void;
  onProblemUpdate?: (id: string, patch: ProblemPatch) => Promise<void>;
  onJumpToProblem?: (id: string) => void;
  onDelete?: (id: string) => void;
};

const LONG_PRESS_MS = 500;

function MobileRowImpl({
  problem,
  isSelected,
  selectionMode,
  isHighlighted,
  onToggleSelect,
  onStarToggle,
  onProblemUpdate,
  onJumpToProblem,
  onDelete,
}: MobileRowProps) {
  const [editing, setEditing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const ident = problemIdentifier(problem, displayCode(problem));
  const tags: string[] = Array.isArray(problem.tags) ? problem.tags : [];

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const onPointerDown = (e: React.PointerEvent) => {
    longPressed.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    cancel();
    timer.current = setTimeout(() => {
      longPressed.current = true;
      onToggleSelect?.(problem.id);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(15);
    }, LONG_PRESS_MS);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    if (Math.abs(e.clientX - start.current.x) > 8 || Math.abs(e.clientY - start.current.y) > 8) cancel();
  };
  const activate = () => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    if (selectionMode) onToggleSelect?.(problem.id);
    else setEditing(true);
  };

  return (
    <li
      id={`problem-row-${problem.id}`}
      data-selected={isSelected ? 'true' : undefined}
      className={cn(
        'relative flex items-start gap-2 border-b border-border py-3 pl-2 pr-2 transition-colors',
        isSelected ? 'bg-ember-soft' : 'active:bg-muted/60',
        isHighlighted && 'animate-row-highlight'
      )}
      style={{ WebkitTouchCallout: 'none', touchAction: 'manipulation' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="grid size-10 shrink-0 place-items-center">
        <CustomCheckbox
          checked={!!isSelected}
          onChange={() => onToggleSelect?.(problem.id)}
          title={isSelected ? `Deselect ${problem.title}` : `Select ${problem.title}`}
          size={18}
          className={cn(!selectionMode && !isSelected && 'opacity-60')}
        />
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${problem.title}${selectionMode ? (isSelected ? ', selected' : ', not selected') : '. Open editor'}`}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key === 'Enter') activate();
          if (e.key === ' ') {
            e.preventDefault();
            onToggleSelect?.(problem.id);
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        className="min-w-0 flex-1 cursor-pointer select-none rounded-md py-1"
      >
        <div className="flex min-w-0 items-center gap-2">
          <PlatformLogo platform={problem.platform} size={16} />
          {ident && <span className="shrink-0 font-mono text-[11.5px] text-faint">{ident}</span>}
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">{problem.title}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <DifficultyChip difficulty={problem.difficulty} className="h-[22px] px-2 text-[11px]" />
          {problem.topic && <TopicPill topic={problem.topic} className="h-[22px] max-w-[150px] px-2 text-[11px]" />}
          {tags.length > 0 && <span className="chip h-[22px] px-2 font-mono text-[10.5px]">#{tags.length}</span>}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <StatusBadge problem={problem} className="text-[11px]" />
          <span aria-hidden className="h-3 w-px bg-border" />
          <RevisionLabel problem={problem} className="text-[11px]" />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center">
        <StarButton on={!!problem.isFavorite} onToggle={() => onStarToggle(problem.id, !!problem.isFavorite)} className="size-10" size={16} />
        {problem.url && (
          <a
            href={problem.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${problem.title}`}
            onPointerDown={(e) => e.stopPropagation()}
            className="inline-grid size-10 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground"
          >
            <ArrowUpRight size={16} aria-hidden />
          </a>
        )}
      </div>
      {editing && (
        <ProblemEditor
          problem={problem}
          onClose={() => setEditing(false)}
          onSave={onProblemUpdate}
          onJumpToProblem={onJumpToProblem}
          onDelete={onDelete}
        />
      )}
    </li>
  );
}

export const MobileRow = memo(MobileRowImpl);
