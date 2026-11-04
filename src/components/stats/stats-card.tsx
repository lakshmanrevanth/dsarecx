import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A titled paper card for one chart or list on the Stats page. */
export function StatsCard({
  id,
  index,
  kicker,
  title,
  subtitle,
  children,
  aside,
  className,
}: {
  id: string;
  /** Eyebrow number, e.g. "02". */
  index?: string;
  /** Short mono label after the number, e.g. "Recall". */
  kicker?: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn('card min-w-0 px-5 pb-5 pt-6 md:px-7 md:pb-7', className)}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {(index || kicker) && (
            <p className="eyebrow mb-3">
              {index ? `(${index}) ` : ''}
              {kicker}
            </p>
          )}
          <h2 id={`${id}-title`} className="font-serif text-[28px] leading-[1.05] tracking-[-0.01em] text-foreground">
            {title}
          </h2>
          {subtitle && <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
