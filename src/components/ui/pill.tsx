import type { CSSProperties, ReactNode } from 'react';
import { getTopicColor } from '@/lib/topic-colors';
import { cn } from '@/lib/utils';

/**
 * Inline colours for a topic chip, from the `--topic-N` palette.
 * getTopicColor picks the slot (stable hash); the tint is mixed here so it works in both themes.
 */
export function topicStyle(topic: string): CSSProperties {
  const slot = /--topic-(\d+)/.exec(getTopicColor(topic || '').text)?.[1];
  if (!slot) return { color: 'var(--muted-foreground)', background: 'var(--muted)', borderColor: 'var(--border)' };
  const c = `var(--topic-${slot})`;
  return {
    color: c,
    background: `color-mix(in oklab, ${c} 11%, transparent)`,
    borderColor: `color-mix(in oklab, ${c} 30%, transparent)`,
  };
}

/** Chip with explicit colours (any CSS colour or variable). */
export function Pill({
  bg,
  text,
  border,
  className,
  children,
  title,
}: {
  bg?: string;
  text?: string;
  border?: string;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      className={cn('chip max-w-full', className)}
      style={{ background: bg, color: text, borderColor: border }}
      title={title}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Chip coloured by topic name. Empty topics render a muted dash. */
export function TopicPill({ topic, className, children }: { topic: string; className?: string; children?: ReactNode }) {
  return (
    <span className={cn('chip max-w-full', className)} style={topicStyle(topic)} title={topic || undefined}>
      <span className="truncate">{children ?? (topic || '—')}</span>
    </span>
  );
}
