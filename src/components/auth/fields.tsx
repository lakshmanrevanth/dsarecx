'use client';

import { useState } from 'react';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Rendered at the right of the label row (e.g. "Forgot password?"). */
  action?: React.ReactNode;
  hint?: React.ReactNode;
};

export function Field({ id, label, value, onChange, action, hint, className, ...rest }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label">
          {label}
        </label>
        {action}
      </div>
      <input id={id} className="field h-11 text-[15px]" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={hintId} {...rest} />
      {hint ? (
        <p id={hintId} className="mt-1.5 text-[12.5px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField(props: Omit<FieldProps, 'type'>) {
  const [shown, setShown] = useState(false);
  const { id, label, value, onChange, action, hint, className, ...rest } = props;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label">
          {label}
        </label>
        {action}
      </div>
      <div className="relative">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          className="field h-11 pr-11 text-[15px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hintId}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          aria-controls={id}
        >
          {shown ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </div>
      {hint ? (
        <p id={hintId} className="mt-1.5 text-[12.5px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Notice({ error, success, id }: { error?: string; success?: string; id?: string }) {
  return (
    <div id={id}>
      {error ? (
        <p role="alert" className="mb-5 rounded-lg border border-error-border bg-error-bg px-3.5 py-2.5 text-[13.5px] leading-snug text-error">
          {error}
        </p>
      ) : success ? (
        <p role="status" className="mb-5 rounded-lg border border-success-border bg-success-bg px-3.5 py-2.5 text-[13.5px] leading-snug text-success">
          {success}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  loading,
  disabled,
  children,
  className,
}: {
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button type="submit" className={cn('btn btn-primary btn-lg w-full', className)} disabled={disabled || loading} aria-busy={loading || undefined}>
      {loading ? <LoaderCircle size={18} className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function TextButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'rounded text-[13px] font-medium text-foreground underline decoration-border-strong underline-offset-4 transition-colors hover:text-ember hover:decoration-ember disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
