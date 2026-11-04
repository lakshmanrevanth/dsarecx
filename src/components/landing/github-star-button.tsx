'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';
import { GitHubIcon } from './primitives';

const CACHE_KEY = 'dsarecx_github_stars';

export function formatStars(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return count.toString();
}

type Props = {
  variant?: 'navbar' | 'sidebar';
  className?: string;
};

/**
 * "Star on GitHub" link with a live count from /api/github/stars.
 * Renders nothing when NEXT_PUBLIC_GITHUB_REPO is not set.
 */
export function GitHubStarButton({ variant = 'navbar', className }: Props = {}) {
  // Server and first client render must match, so the cached count is only
  // read after hydration. null = unknown (loading, or GitHub unavailable).
  const [stars, setStars] = useState<number | null>(null);
  const repoUrl = siteConfig.githubUrl;

  useEffect(() => {
    if (!repoUrl) return;
    let mounted = true;
    let cached: number | null = null;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      const n = raw === null ? Number.NaN : Number(raw);
      if (Number.isFinite(n) && n >= 0) cached = n;
    } catch {}

    fetch('/api/github/stars')
      .then((res) => res.json())
      .then((data: { stars?: unknown }) => {
        if (!mounted) return;
        if (typeof data?.stars === 'number') {
          setStars(data.stars);
          try {
            localStorage.setItem(CACHE_KEY, String(data.stars));
          } catch {}
        } else if (cached !== null) {
          setStars(cached);
        }
      })
      .catch(() => {
        if (mounted && cached !== null) setStars(cached);
      });

    return () => {
      mounted = false;
    };
  }, [repoUrl]);

  if (!repoUrl) return null;

  const label =
    stars === null ? `Star ${siteConfig.name} on GitHub` : `Star ${siteConfig.name} on GitHub (${stars} stars)`;
  const count = stars === null ? '–' : formatStars(stars);

  if (variant === 'sidebar') {
    return (
      <a
        data-sidebar-github
        href={repoUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title={label}
        className={cn(
          'group flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
          className,
        )}
      >
        <span className="flex items-center gap-2.5">
          <GitHubIcon />
          <span>Star on GitHub</span>
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[11.5px]">
          <Star size={11} className="fill-ember text-ember" aria-hidden />
          {count}
        </span>
      </a>
    );
  }

  return (
    <a
      data-nav-github
      href={repoUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        'group inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card/70 px-3 text-[13px] font-medium text-foreground transition-colors hover:border-border-strong hover:bg-card',
        className,
      )}
    >
      <GitHubIcon size={15} />
      <span className="hidden sm:inline">Star</span>
      <span aria-hidden className="h-3.5 w-px bg-border" />
      <span className="inline-flex items-center gap-1 font-mono text-[11.5px] text-muted-foreground group-hover:text-foreground">
        <Star
          size={11}
          aria-hidden
          className="fill-ember text-ember transition-transform duration-200 group-hover:rotate-12 group-hover:scale-110"
        />
        {count}
      </span>
    </a>
  );
}
