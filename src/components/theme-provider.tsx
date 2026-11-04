'use client';

import * as React from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

type ThemeContextValue = {
  /** The user's choice, which may be "system". */
  theme: Theme;
  /** What is shown: light or dark. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);
const MEDIA = '(prefers-color-scheme: dark)';
export const THEME_COLORS = { light: '#f0ebe1', dark: '#161311' } as const;

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function getSystemTheme(): ResolvedTheme {
  try {
    return window.matchMedia(MEDIA).matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(theme: ResolvedTheme, disableTransition: boolean) {
  const root = document.documentElement;
  if (disableTransition) {
    root.classList.add('disable-transitions');
    window.setTimeout(() => root.classList.remove('disable-transitions'), 0);
  }
  root.classList.toggle('light', theme === 'light');
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = THEME_COLORS[theme];
  });
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'theme',
  disableTransitionOnChange = false,
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  disableTransitionOnChange?: boolean;
}) {
  // Server and first client render match; the stored choice is applied after hydration.
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolved] = React.useState<ResolvedTheme>('light');

  React.useEffect(() => {
    let stored: Theme | null = null;
    try {
      const v = localStorage.getItem(storageKey);
      stored = isTheme(v) ? v : null;
    } catch {}
    const initial = stored ?? defaultTheme;
    // Read after hydration on purpose, so server and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(initial);
    setResolved(resolveTheme(initial));
  }, [defaultTheme, storageKey]);

  React.useEffect(() => {
    const resolved = resolveTheme(theme);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResolved(resolved);
    applyTheme(resolved, disableTransitionOnChange);
    if (theme !== 'system') return;
    const mq = window.matchMedia(MEDIA);
    const onChange = () => {
      const r = getSystemTheme();
      setResolved(r);
      applyTheme(r, disableTransitionOnChange);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, disableTransitionOnChange]);

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey && isTheme(e.newValue)) setThemeState(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  const setTheme = React.useCallback(
    (next: Theme) => {
      try {
        localStorage.setItem(storageKey, next);
      } catch {}
      setThemeState(next);
    },
    [storageKey],
  );

  const value = React.useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
