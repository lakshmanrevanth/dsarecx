'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CompletedRow, type ProblemCompletedItem } from './completed-row';

type Confidence = 'CLEAN' | 'SHAKY' | 'STRUGGLED';

type CompletedSectionProps = {
  problems: ProblemCompletedItem[];
  onUndo: (id: string) => Promise<void>;
  onChangeConfidence: (id: string, conf: Confidence) => Promise<void>;
  /** Section number for the eyebrow, e.g. "03". */
  index?: string;
};

/** Today's ratings, collapsible. The toggle is a direct child of the section root. */
export function CompletedSection({ problems, onUndo, onChangeConfidence, index = '03' }: CompletedSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const bodyId = useId();

  if (!problems || problems.length === 0) return null;

  return (
    <div className="mt-14">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        className="group flex w-full items-center justify-between gap-4 border-b border-border pb-3 text-left"
      >
        <span className="eyebrow">
          ({index}) Completed Today
          <span className="rounded-full bg-muted px-2 py-px text-[10.5px] tracking-normal text-foreground">{problems.length}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground group-hover:text-foreground">
          {collapsed ? 'Show' : 'Hide'}
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            aria-hidden
            className={cn('transition-transform duration-150', collapsed && '-rotate-90')}
          />
        </span>
      </button>

      <div id={bodyId} hidden={collapsed} className="card mt-4 overflow-visible">
        {problems.map((p) => (
          <CompletedRow key={p.id} problem={p} onUndo={onUndo} onChangeConfidence={onChangeConfidence} />
        ))}
      </div>
    </div>
  );
}
