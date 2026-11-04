import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';

/** Wordmark: ember dot + italic serif name, as in the nav and sidebar. */
export function Brand({ href = '/', className, size = 'md' }: { href?: string | null; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const text = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-xl' : 'text-[26px]';
  const inner = (
    <span className={cn('inline-flex items-center gap-2 leading-none', className)}>
      <span className="ember-dot" aria-hidden />
      <span className={cn('font-serif italic tracking-tight text-foreground', text)}>{siteConfig.logoWord}</span>
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} aria-label={`${siteConfig.name} home`} className="rounded-full">
      {inner}
    </Link>
  );
}
