import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Text input on the `.field` design class. */
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn('field', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn('field', className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn('field', className)} {...props} />;
}

/** Mono uppercase label (`.label`). */
export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('label', className)} {...props} />;
}

/** Label + control + optional hint or error, stacked. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="label">
          {label}
        </label>
      ) : (
        <span className="label">{label}</span>
      )}
      {children}
      {error ? (
        <span role="alert" className="mt-1.5 text-xs text-error">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1.5 text-xs text-faint">{hint}</span>
      ) : null}
    </div>
  );
}
