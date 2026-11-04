'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

const ORDER: Theme[] = ['light', 'dark', 'system'];
const LABEL: Record<Theme, string> = { light: 'Light', dark: 'Dark', system: 'System' };

/** Small icon button that cycles light → dark → system. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className={cn('btn btn-ghost btn-icon', className)}
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[next]}.`}
      title={`Theme: ${LABEL[theme]}`}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
