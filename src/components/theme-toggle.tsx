'use client';

import * as React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

type ThemeToggleProps = {
  /**
   * segmented: Light / Dark / System with labels (settings, mobile "More" sheet).
   * sidebar:   the same three choices as a compact icon group.
   * icon | nav | ghost: one button that flips light ↔ dark.
   */
  variant?: 'icon' | 'sidebar' | 'segmented' | 'nav' | 'ghost';
  className?: string;
  style?: React.CSSProperties;
};

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

const emptySubscribe = () => () => {};

export function ThemeToggle({ variant = 'icon', className, style }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  // The stored choice is only known after hydration.
  const mounted = React.useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (variant === 'segmented' || variant === 'sidebar') {
    const compact = variant === 'sidebar';
    return (
      <div
        role="group"
        aria-label="Theme"
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-border bg-card p-1',
          compact ? '' : 'w-full',
          className,
        )}
        style={style}
      >
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = mounted && theme === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              aria-label={compact ? `${label} theme` : undefined}
              title={compact ? `${label} theme` : undefined}
              onClick={() => setTheme(value)}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-full text-[13px] font-medium transition-colors',
                compact ? 'h-7 w-7' : 'h-8 flex-1 px-3',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon size={compact ? 14 : 15} strokeWidth={1.75} aria-hidden />
              {!compact && <span>{label}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  const isDark = mounted && resolvedTheme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className={cn('btn btn-icon', variant === 'ghost' ? 'btn-ghost' : 'btn-outline', className)}
      style={style}
    >
      {mounted ? (
        isDark ? <Sun size={16} strokeWidth={1.75} aria-hidden /> : <Moon size={16} strokeWidth={1.75} aria-hidden />
      ) : (
        <span className="block h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
