import { cn } from '@/lib/utils';

/**
 * Page container for the public site. On wider screens the left padding clears
 * the red margin rule that `.paper` draws at 63px.
 */
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('mx-auto w-full max-w-[1240px] px-4 sm:pl-[92px] sm:pr-8 lg:pr-[92px]', className)}>{children}</div>
  );
}

/** "(02) HOW IT WORKS" eyebrow followed by a serif heading and an optional lede. */
export function SectionHeading({
  index,
  label,
  title,
  lede,
  id,
  className,
  align = 'left',
}: {
  index: string;
  label: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  id?: string;
  className?: string;
  align?: 'left' | 'center';
}) {
  return (
    <header className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center', className)}>
      <p className="eyebrow">({index}) {label}</p>
      <h2 id={id} className="display mt-5 text-[clamp(40px,6vw,76px)] text-foreground">
        {title}
      </h2>
      {lede ? (
        <p className={cn('mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground', align === 'center' && 'mx-auto')}>
          {lede}
        </p>
      ) : null}
    </header>
  );
}

/** A full-width landing section with consistent vertical rhythm. */
export function Section({
  id,
  labelledBy,
  className,
  children,
}: {
  id: string;
  labelledBy?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} data-landing-section className={cn('scroll-mt-24 py-24 sm:py-32', className)}>
      {children}
    </section>
  );
}

/** GitHub mark (lucide no longer ships brand icons). */
export function GitHubIcon({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden className={cn('shrink-0', className)}>
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}

