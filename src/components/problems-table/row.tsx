'use client';

import { memo, useState } from 'react';
import { ArrowUpRight, PenLine } from 'lucide-react';
import { CustomCheckbox } from '@/components/ui/custom-checkbox';
import { PlatformLogo } from '@/lib/platforms/logos';
import { displayCode } from '@/lib/platforms/problem-input';
import { cn } from '@/lib/utils';
import { DifficultyPickerCell, InlineTextCell, StarButton, TopicPickerCell } from './cells';
import { CustomCell } from './custom-cell';
import { NextRevisionCell } from './next-revision-cell';
import { ProblemEditor, useProblemPatch, type ProblemPatch } from './problem-editor';
import { REVEAL, StatusBadge, problemIdentifier, type Json } from './shared';
import { TagsCell } from './tag-input';

export type ProblemRowProps = {
  problem: Json;
  columns: Json[];
  isSelected: boolean;
  isHighlighted?: boolean;
  onToggleSelect: (id: string) => void;
  onStarToggle: (id: string, current: boolean) => void;
  onDifficultySave: (id: string, difficulty: string) => Promise<void> | void;
  onTopicSave: (id: string, topic: string) => Promise<void> | void;
  onNotesSave: (id: string, notes: string) => Promise<void> | void;
  onCustomFieldSave: (id: string, columnName: string, value: string) => Promise<void> | void;
  /** Saves tags; defaults to onProblemUpdate / a built-in optimistic PATCH. */
  onTagsSave?: (id: string, tags: string[]) => Promise<void> | void;
  /** Generic edit (editor panel, next review). Should throw on failure. */
  onProblemUpdate?: (id: string, patch: ProblemPatch) => Promise<void>;
  /** Scroll to + highlight another row (for "already tracked" conflicts). */
  onJumpToProblem?: (id: string) => void;
  onDelete?: (id: string) => void;
  topicSuggestions?: string[];
  tagSuggestions?: string[];
};

function ProblemRowImpl({
  problem,
  columns,
  isSelected,
  isHighlighted,
  onToggleSelect,
  onStarToggle,
  onDifficultySave,
  onTopicSave,
  onNotesSave,
  onCustomFieldSave,
  onTagsSave,
  onProblemUpdate,
  onJumpToProblem,
  onDelete,
  topicSuggestions,
  tagSuggestions,
}: ProblemRowProps) {
  const [editing, setEditing] = useState(false);
  const builtIn = useProblemPatch();
  const update = onProblemUpdate ?? builtIn;
  const tags: string[] = Array.isArray(problem.tags) ? problem.tags : [];
  const ident = problemIdentifier(problem, displayCode(problem));
  const fields = (problem.customFields as Record<string, string>) ?? {};

  return (
    <tr
      id={`problem-row-${problem.id}`}
      data-selected={isSelected ? 'true' : undefined}
      className={cn('group/row h-12 transition-colors', isHighlighted && 'animate-row-highlight')}
    >
      <td className="w-10 px-2 text-center">
        <div className={cn('flex justify-center', !isSelected && REVEAL)}>
          <CustomCheckbox checked={isSelected} onChange={() => onToggleSelect(problem.id)} title={`Select ${problem.title}`} />
        </div>
      </td>
      <td className="w-11 px-1">
        <div className="flex justify-center">
          <PlatformLogo platform={problem.platform} size={18} />
        </div>
      </td>
      <td className="px-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {ident && <span className="shrink-0 font-mono text-xs tabular-nums text-faint">{ident}</span>}
          {problem.url ? (
            <a
              data-problem-title
              href={problem.url}
              target="_blank"
              rel="noopener noreferrer"
              title={problem.title}
              className="group/link inline-flex min-w-0 items-center gap-1 text-[14px] font-medium text-foreground decoration-ember underline-offset-4 hover:underline"
            >
              <span className="truncate">{problem.title}</span>
              <ArrowUpRight size={13} aria-hidden className="shrink-0 text-faint opacity-0 transition-opacity group-hover/link:opacity-100" />
            </a>
          ) : (
            <span className="truncate text-[14px] font-medium text-foreground" title={problem.title}>
              {problem.title}
            </span>
          )}
          <button
            type="button"
            data-edit-problem
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            aria-label={`Edit ${problem.title}`}
            title="Edit title, URL, dates, notes…"
            className={cn('ml-auto inline-grid size-7 shrink-0 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground', REVEAL)}
          >
            <PenLine size={14} aria-hidden />
          </button>
        </div>
        {editing && (
          <ProblemEditor problem={problem} onClose={() => setEditing(false)} onSave={update} onJumpToProblem={onJumpToProblem} onDelete={onDelete} />
        )}
      </td>
      <td className="px-3">
        <DifficultyPickerCell difficulty={problem.difficulty} onSave={(d) => onDifficultySave(problem.id, d)} />
      </td>
      <td className="px-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 shrink">
            <TopicPickerCell topic={problem.topic ?? ''} suggestions={topicSuggestions} onSave={(t) => onTopicSave(problem.id, t)} />
          </span>
          <TagsCell
            tags={tags}
            suggestions={tagSuggestions}
            onSave={(t) => (onTagsSave ? onTagsSave(problem.id, t) : update(problem.id, { tags: t }))}
          />
        </div>
      </td>
      <td className="px-3">
        <StatusBadge problem={problem} />
      </td>
      <td className="px-1 text-center">
        <StarButton on={!!problem.isFavorite} onToggle={() => onStarToggle(problem.id, !!problem.isFavorite)} />
      </td>
      <td className="px-3">
        <NextRevisionCell problem={problem} onSave={(key) => update(problem.id, { nextRevisionOn: key })} />
      </td>
      <td className="px-2">
        <InlineTextCell value={problem.notes ?? ''} label="Notes" placeholder="Add notes…" onSave={(v) => onNotesSave(problem.id, v)} />
      </td>
      {columns.map((col) => (
        <td key={col.id} className="px-2">
          <CustomCell column={col} value={fields[col.name]} onSave={(v) => onCustomFieldSave(problem.id, col.name, v)} />
        </td>
      ))}
      <td />
    </tr>
  );
}

export const ProblemRow = memo(ProblemRowImpl);
