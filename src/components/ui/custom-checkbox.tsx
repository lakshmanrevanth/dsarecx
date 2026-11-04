'use client';

import type { MouseEvent } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CustomCheckboxProps = {
  checked: boolean | 'mixed';
  onChange: (e: MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  /** Accessible name; falls back to `title`. */
  ariaLabel?: string;
  /** id of an element that labels this checkbox. */
  ariaLabelledBy?: string;
  disabled?: boolean;
  /** Box size in px (default 16). Touch targets get padding from the caller. */
  size?: number;
  className?: string;
};

/**
 * Accessible checkbox: a real <button role="checkbox"> so Space/Enter toggle it,
 * styled as a small paper square that fills ember when checked.
 */
export function CustomCheckbox({
  checked,
  onChange,
  title,
  ariaLabel,
  ariaLabelledBy,
  disabled = false,
  size = 16,
  className,
}: CustomCheckboxProps) {
  const on = checked === true;
  const mixed = checked === 'mixed';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? 'mixed' : on}
      aria-label={ariaLabelledBy ? undefined : ariaLabel ?? title}
      aria-labelledby={ariaLabelledBy}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(e);
      }}
      className={cn(
        'inline-grid shrink-0 cursor-pointer place-items-center rounded-[5px] border transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        on || mixed
          ? 'border-ember bg-ember text-[hsl(40_53%_97%)] dark:text-[hsl(24_12%_8%)]'
          : 'border-border-strong bg-card text-transparent hover:border-ember',
        className
      )}
      style={{ width: size, height: size }}
    >
      {mixed ? (
        <Minus size={Math.round(size * 0.7)} strokeWidth={3} aria-hidden />
      ) : (
        <Check size={Math.round(size * 0.7)} strokeWidth={3} aria-hidden />
      )}
    </button>
  );
}
