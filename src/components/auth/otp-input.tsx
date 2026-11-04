'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/** Digits only, at most `length` of them. Exported for tests. */
export function sanitizeCode(text: string, length = 6): string {
  return text.replace(/\D/g, '').slice(0, length);
}

type OtpInputProps = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
  /** id of the element that labels the whole group */
  labelledBy?: string;
  /** id of an element that describes it (e.g. the error message) */
  describedBy?: string;
  idPrefix?: string;
};

/**
 * Six one-digit boxes. Paste or SMS/email autofill (autocomplete="one-time-code")
 * drops the whole code in at once; Backspace and the arrow keys move between boxes.
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = true,
  labelledBy,
  describedBy,
  idPrefix = 'otp',
}: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  // Empty boxes before the last filled one are kept as spaces so digits never shift.
  const digits = Array.from({ length }, (_, i) => (value[i] && value[i] !== ' ' ? value[i] : ''));
  const join = (arr: string[]) => arr.map((c) => c || ' ').join('').replace(/\s+$/, '');

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const fillAll = (text: string) => {
    const clean = sanitizeCode(text, length);
    if (!clean) return;
    onChange(clean);
    refs.current[Math.min(clean.length, length - 1)]?.focus();
    if (clean.length === length) onComplete?.(clean);
  };

  const handleChange = (index: number, raw: string) => {
    if (!raw) return;
    // Autofill (or typing fast into a selected box) can deliver several digits at once.
    if (sanitizeCode(raw, length).length > 1) {
      fillAll(sanitizeCode(digits.slice(0, index).join('') + raw, length));
      return;
    }
    const ch = raw.slice(-1);
    if (!/^\d$/.test(ch)) return;
    const next = [...digits];
    next[index] = ch;
    const joined = join(next);
    onChange(joined);
    if (index < length - 1) refs.current[index + 1]?.focus();
    if (next.every(Boolean)) onComplete?.(joined);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = '';
        onChange(join(next));
      } else if (index > 0) {
        next[index - 1] = '';
        onChange(join(next));
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : `${length}-digit code`}
      aria-describedby={describedBy}
      className="flex items-center justify-between gap-2 sm:gap-2.5"
    >
      {digits.map((d, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          id={`${idPrefix}-${index}`}
          name={index === 0 ? `${idPrefix}-code` : undefined}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={error || undefined}
          maxLength={index === 0 ? length : 1}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => {
            e.preventDefault();
            fillAll(e.clipboardData.getData('text/plain'));
          }}
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-14 w-full min-w-0 max-w-[56px] rounded-lg border bg-card text-center font-mono text-[22px] font-medium text-foreground transition-[border-color,box-shadow] duration-150',
            'focus:border-ember focus:shadow-[0_0_0_3px_var(--ember-soft)] focus:outline-none',
            error ? 'border-error' : d ? 'border-border-strong' : 'border-input',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        />
      ))}
    </div>
  );
}
