import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Loading shimmer block (`.skeleton`). Hidden from assistive tech. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden className={cn('skeleton', className)} {...props} />;
}
