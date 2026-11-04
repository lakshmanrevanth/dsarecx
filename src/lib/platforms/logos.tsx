import * as React from 'react';

export type PlatformLogoProps = {
  platform: string;
  size?: number;
  padding?: number;
  borderRadius?: number | string;
  background?: string;
  className?: string;
  style?: React.CSSProperties;
};

type LogoSource = {
  light: string;
  dark: string;
  fallbackLight?: string;
  fallbackDark?: string;
  /** Render separate light/dark images, toggled by the .platform-logo-* CSS classes. */
  hasThemeVariant: boolean;
  opacity?: number;
};

const LOGO_CONFIG: Record<string, LogoSource> = {
  LEETCODE: {
    light: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/leetcode.svg',
    dark: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/leetcode-dark.svg',
    fallbackLight: '/leetcode.svg',
    fallbackDark: '/leetcode-dark.svg',
    hasThemeVariant: true,
  },
  CODEFORCES: {
    light: '/codeforces.svg',
    dark: '/codeforces.svg',
    fallbackLight: '/codeforces.svg',
    fallbackDark: '/codeforces.svg',
    hasThemeVariant: false,
  },
  GFG: {
    light: 'https://cdn.simpleicons.org/geeksforgeeks/2F8D46',
    dark: 'https://cdn.simpleicons.org/geeksforgeeks/2F8D46',
    fallbackLight: '/gfg.svg',
    fallbackDark: '/gfg.svg',
    hasThemeVariant: false,
  },
  HACKERRANK: {
    light: '/HackerRank.png',
    dark: '/HackerRank.png',
    fallbackLight: '/HackerRank.png',
    fallbackDark: '/HackerRank.png',
    hasThemeVariant: false,
  },
  CODECHEF: {
    light: 'https://cdn.simpleicons.org/codechef/000000',
    dark: 'https://cdn.simpleicons.org/codechef/FFFFFF',
    fallbackLight: '/codechef.svg',
    fallbackDark: '/codechef-dark.svg',
    hasThemeVariant: true,
  },
};

const ALIASES: Record<string, string> = {
  GEEKSFORGEEKS: 'GFG',
  GEEKS_FOR_GEEKS: 'GFG',
  HACKER_RANK: 'HACKERRANK',
  CODE_CHEF: 'CODECHEF',
  CODE_FORCES: 'CODEFORCES',
  LEET_CODE: 'LEETCODE',
};

/** Upper-cases a platform name and maps common spellings to the enum value. */
export function normalizePlatform(platform: string = ''): string {
  const p = (platform || '').trim().toUpperCase();
  return ALIASES[p] ?? p;
}

/** Swaps to the local fallback once if the (usually CDN) image fails to load. */
function fallbackTo(fallback: string | undefined) {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (fallback && !e.currentTarget.src.endsWith(fallback)) e.currentTarget.src = fallback;
  };
}

function SystemDesignGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="100%" height="100%" fill="none" aria-hidden="true">
      <rect x="5.5" y="1" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1" y="11" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="10" y="11" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 5v3M3.5 11V8h9v3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function PlatformLogo({
  platform = 'LEETCODE',
  size = 20,
  padding = 0,
  borderRadius = 4,
  background = 'transparent',
  className = '',
  style,
}: PlatformLogoProps) {
  const key = normalizePlatform(platform);
  const radius = borderRadius ?? 4;

  // System design concepts have no external logo: a small node diagram in the text colour.
  if (key === 'SYSTEM_DESIGN') {
    return (
      <span
        role="img"
        aria-label="System design"
        title="System design"
        className={`inline-flex items-center justify-center shrink-0 select-none ${className}`}
        style={{ width: size, height: size, padding, borderRadius: radius, background, boxSizing: 'border-box', color: 'var(--text-dim)', ...style }}
      >
        <SystemDesignGlyph />
      </span>
    );
  }

  const cfg = LOGO_CONFIG[key] || LOGO_CONFIG.LEETCODE;
  const imgStyle = cfg.opacity !== undefined && cfg.opacity !== 1 ? { opacity: cfg.opacity } : undefined;
  const imgClass = 'w-full h-full object-contain pointer-events-none';

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 select-none overflow-hidden ${className}`}
      style={{ width: size, height: size, background, borderRadius: radius, padding, boxSizing: 'border-box', ...style }}
      title={platform}
    >
      {cfg.hasThemeVariant ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cfg.light} alt={platform} style={imgStyle} className={`platform-logo-light block ${imgClass}`} onError={fallbackTo(cfg.fallbackLight)} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cfg.dark} alt={platform} style={imgStyle} className={`platform-logo-dark hidden ${imgClass}`} onError={fallbackTo(cfg.fallbackDark)} />
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cfg.light} alt={platform} style={imgStyle} className={`block ${imgClass}`} onError={fallbackTo(cfg.fallbackLight)} />
      )}
    </span>
  );
}
