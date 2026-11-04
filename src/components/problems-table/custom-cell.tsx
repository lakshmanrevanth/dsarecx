'use client';

// Renders and edits one custom-column value according to the column's type
// (text, select, date, checkbox, link). Saves on Enter / blur / change.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { CustomCheckbox } from '@/components/ui/custom-checkbox';
import { formatCustomValue, isChecked, parseCustomValue, toCustomColumn, type CustomColumn } from '@/lib/custom-columns';
import { cn } from '@/lib/utils';

type ColumnLike = { id: string; name: string; type?: string | null; options?: unknown; order?: number };

export type CustomCellProps = {
  column: ColumnLike;
  value: string | undefined | null;
  onSave: (value: string) => Promise<void> | void;
};

const display =
  'flex h-8 w-full min-w-0 items-center rounded-md px-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted/70';

export function CustomCell({ column: raw, value, onSave }: CustomCellProps) {
  const column: CustomColumn = toCustomColumn({ order: 0, ...raw });
  const stored = value ?? '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stored);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayRef = useRef<HTMLButtonElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      if (column.type !== 'date') inputRef.current?.select();
    }
  }, [editing, column.type]);

  const save = async (rawValue: string) => {
    const parsed = parseCustomValue(column, rawValue);
    if (!parsed.ok) {
      setError(parsed.error);
      return false;
    }
    setError(null);
    if (parsed.value === stored) return true;
    setSaving(true);
    try {
      await onSave(parsed.value);
    } catch {
      setDraft(stored); // the parent toasts
    } finally {
      setSaving(false);
    }
    return true;
  };

  const commit = async () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    if (await save(draft)) {
      setEditing(false);
      setTimeout(() => displayRef.current?.focus(), 0);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelled.current = true;
      setDraft(stored);
      setError(null);
      setEditing(false);
      setTimeout(() => {
        cancelled.current = false;
        displayRef.current?.focus();
      }, 0);
    }
  };

  if (column.type === 'checkbox') {
    const checked = isChecked(stored);
    return (
      <div className={cn('flex h-8 items-center px-2', saving && 'opacity-60')}>
        <CustomCheckbox checked={checked} ariaLabel={column.name} disabled={saving} onChange={() => save(checked ? '' : 'true')} />
      </div>
    );
  }

  if (column.type === 'select') {
    const known = column.options.some((o) => o === stored);
    return (
      <select
        aria-label={column.name}
        value={stored}
        disabled={saving}
        onChange={(e) => save(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        title={stored || undefined}
        className={cn(display, 'cursor-pointer appearance-none bg-transparent pr-6', !stored && 'text-faint', saving && 'opacity-60')}
      >
        <option value="">—</option>
        {!known && stored && <option value={stored}>{stored}</option>}
        {column.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (editing) {
    return (
      <div className="relative w-full">
        <input
          ref={inputRef}
          type={column.type === 'date' ? 'date' : column.type === 'url' ? 'url' : 'text'}
          aria-label={column.name}
          aria-invalid={!!error}
          aria-describedby={error ? `cc-err-${column.id}` : undefined}
          value={draft}
          disabled={saving}
          placeholder={column.type === 'url' ? 'https://' : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
          className={cn('field h-8 px-2 text-[13px]', error && 'border-error')}
        />
        {error && (
          <div
            id={`cc-err-${column.id}`}
            role="alert"
            className="absolute left-0 top-full z-20 mt-1 whitespace-nowrap rounded-md border border-error-border bg-card px-2 py-1 text-[11.5px] text-error shadow-pop"
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  const text = formatCustomValue(column, stored);
  const start = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(stored);
    setError(null);
    setEditing(true);
  };

  if (column.type === 'url' && stored) {
    return (
      <div className="group/cell flex w-full min-w-0 items-center gap-0.5">
        <a
          href={stored}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={stored}
          className="inline-flex min-w-0 flex-1 items-center gap-1 rounded-md px-2 py-1 text-[13px] text-foreground underline decoration-border-strong underline-offset-2 hover:text-ember hover:decoration-ember"
        >
          <span className="truncate">{text}</span>
          <ArrowUpRight size={12} aria-hidden className="shrink-0 text-faint" />
        </a>
        <button
          ref={displayRef}
          type="button"
          onClick={start}
          aria-label={`Edit ${column.name} link`}
          className="shrink-0 rounded-md px-1.5 py-1 font-mono text-[10px] uppercase tracking-wider text-faint opacity-0 hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/cell:opacity-100"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <button
      ref={displayRef}
      type="button"
      onClick={start}
      aria-label={`${column.name}: ${text || 'empty'}. Edit`}
      title={text || undefined}
      className={cn(display, column.type === 'date' && 'font-mono text-xs', saving && 'opacity-60')}
    >
      <span className="truncate">{text}</span>
    </button>
  );
}
