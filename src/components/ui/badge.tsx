import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'default' | 'ember' | 'easy' | 'medium' | 'hard' | 'success' | 'error' | 'warning';

const TONE: Record<BadgeTone, string> = {
  default: '',
  ember: 'chip-ember',
  easy: 'chip-easy',
  medium: 'chip-medium',
  hard: 'chip-hard',
  success: 'chip-success',
  error: 'chip-error',
  warning: 'chip-warning',
};

/** Rounded chip (`.chip`). `mono` switches to the uppercase mono variant. */
export function Badge({
  tone = 'default',
  mono = false,
  className,
  ...props
}: ComponentProps<'span'> & { tone?: BadgeTone; mono?: boolean }) {
  return <span className={cn('chip', TONE[tone], mono && 'chip-mono', className)} {...props} />;
}
