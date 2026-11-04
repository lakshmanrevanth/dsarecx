'use client';

// Small building blocks for the settings page: numbered sections, label/control rows,
// a switch, save-state tracking and a JSON fetch helper.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** One numbered section: mono eyebrow, serif title, optional description, then rows. */
export function Section({
  index,
  title,
  description,
  id,
  tone = 'default',
  children,
}: {
  index: number;
  title: string;
  description?: React.ReactNode;
  id: string;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-settings-section
      className={cn(
        'scroll-mt-24',
        tone === 'danger' ? 'rounded-2xl border border-error-border bg-error-bg px-5 py-6 sm:px-7' : 'border-t border-border pt-8'
      )}
    >
      <h2 id={headingId} className={cn('eyebrow', tone === 'danger' && 'text-error')}>
        <span aria-hidden>({String(index).padStart(2, '0')})</span> {title}
      </h2>
      {description && <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">{description}</p>}
      <div className={cn('mt-4', tone === 'danger' ? 'divide-y divide-error-border' : 'divide-y divide-border')}>{children}</div>
    </section>
  );
}

/** Label + description on the left, control on the right (stacked under 640px). */
export function Row({
  label,
  htmlFor,
  labelId,
  description,
  children,
  align = 'center',
  wide = false,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  labelId?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  align?: 'center' | 'start';
  /** Give the control more room (e.g. a form). */
  wide?: boolean;
}) {
  const LabelTag = htmlFor ? 'label' : 'span';
  return (
    <div
      className={cn(
        'grid gap-3 py-5 sm:gap-8',
        wide ? 'sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]' : 'sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]',
        align === 'center' ? 'sm:items-center' : 'sm:items-start'
      )}
    >
      <div className="min-w-0">
        <LabelTag id={labelId} htmlFor={htmlFor} className="block text-[14.5px] font-medium text-foreground">
          {label}
        </LabelTag>
        {description && <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-ember bg-ember' : 'border-border-strong bg-muted'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-0.5 h-[18px] w-[18px] rounded-full shadow-sm transition-transform duration-150',
          checked ? 'translate-x-5 bg-card' : 'translate-x-0 bg-card'
        )}
      />
    </button>
  );
}

/** Pill segmented control with aria-pressed buttons. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  labelledBy,
  className,
}: {
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode; ariaLabel?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label?: string;
  labelledBy?: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cn('flex w-full rounded-full border border-border bg-card p-1', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-medium transition-colors duration-150',
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export type SaveState = { status: 'idle' | 'saving' | 'saved' | 'error'; message?: string };

/** Tracks saving/saved/error for one section. "Saved" fades after a few seconds. */
export function useSaveState() {
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const run = useCallback(async <T,>(fn: () => Promise<T>, savedMessage = 'Saved'): Promise<T | undefined> => {
    if (timer.current) window.clearTimeout(timer.current);
    setState({ status: 'saving' });
    try {
      const result = await fn();
      setState({ status: 'saved', message: savedMessage });
      timer.current = window.setTimeout(() => setState({ status: 'idle' }), 3000);
      return result;
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Something went wrong' });
      return undefined;
    }
  }, []);

  const fail = useCallback((message: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    setState({ status: 'error', message });
  }, []);
  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, run, fail, reset };
}

export function StatusText({ state, className }: { state: SaveState; className?: string }) {
  let content: React.ReactNode = null;
  if (state.status === 'saving') content = 'Saving…';
  if (state.status === 'saved')
    content = (
      <>
        <Check size={13} strokeWidth={2} className="mr-1 inline align-[-2px]" aria-hidden />
        {state.message ?? 'Saved'}
      </>
    );
  if (state.status === 'error') content = state.message ?? 'Could not save';
  return (
    <div
      role={state.status === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={cn(
        'min-h-[18px] text-[12.5px]',
        state.status === 'saved' && 'text-success',
        state.status === 'error' && 'text-error',
        state.status === 'saving' && 'text-muted-foreground',
        className
      )}
    >
      {content}
    </div>
  );
}

/** fetch + JSON with the server's error message turned into a thrown Error. */
export async function requestJson<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error('Network error. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || `Request failed (${res.status})`) as Error & {
      code?: string;
      status?: number;
    };
    err.code = (data as { code?: string }).code;
    err.status = res.status;
    throw err;
  }
  return data as T;
}
