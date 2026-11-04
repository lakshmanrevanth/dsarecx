// Small visual atoms shared by the daily queue, focus mode and the completed list.

import { PlatformLogo } from '@/lib/platforms/logos';
import { cn } from '@/lib/utils';
import type { Confidence } from './intervals';
import type { DailyItem } from './summary-state';

export const CONF_META: Record<
  Confidence,
  { label: string; hint: string; chip: string; dot: string; text: string; hover: string }
> = {
  CLEAN: {
    label: 'Clean',
    hint: 'Advance',
    chip: 'chip-easy',
    dot: 'bg-easy',
    text: 'text-easy',
    hover: 'hover:border-[var(--easy-border)] hover:bg-[var(--easy-bg)] hover:text-easy',
  },
  SHAKY: {
    label: 'Shaky',
    hint: 'Repeat',
    chip: 'chip-medium',
    dot: 'bg-medium',
    text: 'text-medium',
    hover: 'hover:border-[var(--medium-border)] hover:bg-[var(--medium-bg)] hover:text-medium',
  },
  STRUGGLED: {
    label: 'Struggled',
    hint: 'Reset',
    chip: 'chip-hard',
    dot: 'bg-hard',
    text: 'text-hard',
    hover: 'hover:border-[var(--hard-border)] hover:bg-[var(--hard-bg)] hover:text-hard',
  },
};

export function titleCase(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const DIFF_CHIP: Record<string, string> = { EASY: 'chip-easy', MEDIUM: 'chip-medium', HARD: 'chip-hard' };

export function DifficultyChip({ difficulty, className }: { difficulty?: string | null; className?: string }) {
  if (!difficulty) return null;
  const key = difficulty.toUpperCase();
  return (
    <span className={cn('chip chip-mono h-[22px] px-2 text-[10.5px]', DIFF_CHIP[key], className)}>{titleCase(difficulty)}</span>
  );
}

/** Same hash as the topic colour slots elsewhere, mapped onto the --topic-1..12 tokens. */
export function topicSlot(topic: string): number {
  const t = topic.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < t.length; i++) hash = t.charCodeAt(i) + ((hash << 5) - hash);
  return (Math.abs(hash) % 12) + 1;
}

/** Topic as a coloured dot plus muted text (quiet next to the difficulty chip). */
export function TopicTag({ topic, className }: { topic?: string | null; className?: string }) {
  if (!topic || !topic.trim()) return null;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `var(--topic-${topicSlot(topic)})` }} />
      <span className="truncate">{topic}</span>
    </span>
  );
}

export function LateChip({ days }: { days?: number | null }) {
  if (!days || days <= 0) return null;
  return (
    <span
      className="chip chip-error chip-mono h-[22px] shrink-0 px-2 text-[10.5px]"
      title={`Was due ${days} day${days === 1 ? '' : 's'} ago`}
    >
      {days}d late
    </span>
  );
}

export function RecheckChip({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span className="chip chip-mono h-[22px] shrink-0 px-2 text-[10.5px]" title="Mastered problem back for a long-term check">
      Recheck
    </span>
  );
}

const NUMBERED = new Set(['LEETCODE', 'CODEFORCES']);

/** Platform logo plus problem number (LeetCode / Codeforces) or code. */
export function ItemMark({ problem, size = 18 }: { problem: Pick<DailyItem, 'platform' | 'problemNumber' | 'code'>; size?: number }) {
  const platform = problem.platform ?? 'LEETCODE';
  const num = NUMBERED.has(platform) && (problem.problemNumber ?? 0) > 0 ? String(problem.problemNumber) : problem.code || null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <PlatformLogo platform={platform} size={size} padding={1} />
      {num && <span className="font-mono text-[11.5px] tracking-normal text-muted-foreground">{num}</span>}
    </span>
  );
}

/** "Step 2 of 4" as four ticks; mastered items show a filled ladder. */
export function LadderTicks({ step, mastered }: { step?: number | null; mastered?: boolean }) {
  const s = mastered ? 4 : Math.max(0, Math.min(3, step ?? 0)) + 1;
  return (
    <span className="inline-flex items-center gap-0.5" title={mastered ? 'Mastered' : `Ladder step ${s} of 4`}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} aria-hidden className={cn('h-2.5 w-[3px] rounded-full', i <= s ? 'bg-foreground/70' : 'bg-border-strong/60')} />
      ))}
      <span className="sr-only">{mastered ? 'Mastered' : `Ladder step ${s} of 4`}</span>
    </span>
  );
}
