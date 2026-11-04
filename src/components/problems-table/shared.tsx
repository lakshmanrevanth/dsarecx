// Labels, chips and small helpers shared by the table, the draft row and the editor.

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PLATFORM_OPTIONS = [
  { value: 'LEETCODE', label: 'LeetCode' },
  { value: 'CODEFORCES', label: 'Codeforces' },
  { value: 'GFG', label: 'GeeksForGeeks' },
  { value: 'HACKERRANK', label: 'HackerRank' },
  { value: 'CODECHEF', label: 'CodeChef' },
] as const;

export const PLATFORM_LABELS: Record<string, string> = {
  LEETCODE: 'LeetCode',
  CODEFORCES: 'Codeforces',
  CODECHEF: 'CodeChef',
  GFG: 'GeeksForGeeks',
  HACKERRANK: 'HackerRank',
  SYSTEM_DESIGN: 'System Design',
};

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;

export const DEFAULT_TOPICS = [
  'Array',
  'String',
  'Hash Table',
  'Two Pointers',
  'Sliding Window',
  'Binary Search',
  'Linked List',
  'Stack',
  'Queue',
  'Tree',
  'Binary Tree',
  'Binary Search Tree',
  'Graph',
  'Heap / Priority Queue',
  'Dynamic Programming',
  'Greedy',
  'Backtracking',
  'Trie',
  'Bit Manipulation',
  'Union Find',
  'Matrix',
  'Math',
  'Recursion',
  'Sorting',
];

/** "EASY" → "Easy" */
export const cap = (s: string | null | undefined) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '');

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export async function postJson(url: string, body: unknown, init?: RequestInit) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json;
}

/** Number or code shown before the title (LeetCode number, CF/CodeChef code). */
export function problemIdentifier(problem: Json, display: string | null): string | null {
  if (problem.platform === 'CODEFORCES' || problem.platform === 'CODECHEF') return display;
  if (problem.platform === 'LEETCODE' && problem.problemNumber > 0 && problem.problemNumber < 100000) return String(problem.problemNumber);
  return null;
}

const DIFF_CLASS: Record<string, string> = { EASY: 'chip-easy', MEDIUM: 'chip-medium', HARD: 'chip-hard' };

export function DifficultyChip({ difficulty, className, placeholder = '—' }: { difficulty?: string | null; className?: string; placeholder?: string }) {
  const d = difficulty ?? '';
  return (
    <span className={cn('chip', DIFF_CLASS[d] ?? 'border-dashed text-faint', className)}>
      {d ? cap(d) : placeholder}
    </span>
  );
}

type StatusInfo = { label: string; color: string };

/** Status from problem.status plus the last review's confidence. */
export function statusInfo(problem: Json): StatusInfo {
  if (problem.status === 'MASTERED') return { label: 'Mastered', color: 'var(--info)' };
  if (problem.status === 'RETIRED') return { label: 'Retired', color: 'var(--faint)' };
  const c = problem.revisions?.[0]?.confidence ?? null;
  if (!c || problem.revisionCount === 0) return { label: 'Not started', color: 'var(--muted-foreground)' };
  if (c === 'CLEAN') return { label: 'Clean', color: 'var(--easy-text)' };
  if (c === 'SHAKY') return { label: 'Shaky', color: 'var(--medium-text)' };
  return { label: 'Struggled', color: 'var(--hard-text)' };
}

export function StatusBadge({ problem, className }: { problem: Json; className?: string }) {
  const s = statusInfo(problem);
  return (
    <span className={cn('inline-flex items-center gap-2 whitespace-nowrap font-mono text-xs', className)} style={{ color: s.color }}>
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

export function TagChip({ tag, onRemove, className }: { tag: string; onRemove?: () => void; className?: string }) {
  return (
    <span className={cn('chip h-[22px] max-w-[140px] gap-1 px-2 text-[11.5px]', className)} title={tag}>
      <span aria-hidden className="text-faint">#</span>
      <span className="truncate">{tag}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove tag ${tag}`}
          className="-mr-1 inline-grid size-4 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground"
        >
          <X size={10} aria-hidden />
        </button>
      )}
    </span>
  );
}

/** Small keyboard hint line ("Enter to save · Esc to cancel"). */
export function KeyHints({ items, className }: { items: [key: string, text: string][]; className?: string }) {
  return (
    <span className={cn('hidden items-center gap-2 text-[11px] text-faint md:inline-flex', className)}>
      {items.map(([k, t], i) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>·</span>}
          <kbd className="kbd">{k}</kbd>
          {t}
        </span>
      ))}
    </span>
  );
}

/**
 * Hover-only reveal inside a `group/row` (checkboxes, edit buttons, empty-tag hints).
 * Always visible on touch screens, and while the row has keyboard focus.
 */
export const REVEAL =
  'transition-opacity duration-150 pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:group-focus-within/row:opacity-100';

/**
 * Rows from /api/problems and /api/columns are untyped JSON whose shape the API routes own,
 * so the table treats them loosely through this one alias.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

/** What a failed request / thrown value may carry. */
export type Failure = { message?: string; status?: number; existingId?: string | null };
export const failure = (e: unknown): Failure => (e && typeof e === 'object' ? (e as Failure) : {});
