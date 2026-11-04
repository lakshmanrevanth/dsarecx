'use client';

// Dialog for custom columns: add (with a type), rename, reorder, change type/options,
// delete with a confirmation. Usage:
// <ColumnSettings open={open} onClose={() => setOpen(false)} onChanged={() => mutateProblems()} />

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { ArrowDown, ArrowUp, Calendar, CheckSquare, ChevronDown, Link2, Loader2, Plus, Trash2, Type, X } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import {
  COLUMN_TYPES,
  COLUMN_TYPE_LABELS,
  MAX_COLUMNS,
  MAX_COLUMN_NAME_LENGTH,
  normalizeOptions,
  toCustomColumn,
  validateColumnName,
  type ColumnType,
  type CustomColumn,
} from '@/lib/custom-columns';
import { cn } from '@/lib/utils';
import { failure } from './shared';

export type ColumnSettingsProps = {
  open: boolean;
  onClose: () => void;
  /** Called after any change that can affect problems' customFields or the column layout. */
  onChanged?: () => void;
};

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const COLUMN_TYPE_ICONS: Record<ColumnType, typeof Type> = {
  text: Type,
  select: ChevronDown,
  date: Calendar,
  checkbox: CheckSquare,
  url: Link2,
};

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

const iconBtn =
  'inline-grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35';

function ColumnRow({
  column,
  index,
  total,
  all,
  busy,
  onPatch,
  onDelete,
}: {
  column: CustomColumn;
  index: number;
  total: number;
  all: CustomColumn[];
  busy: boolean;
  onPatch: (id: string, body: Record<string, unknown>, label: string) => Promise<boolean>;
  onDelete: (column: CustomColumn) => Promise<void>;
}) {
  const [name, setName] = useState(column.name);
  const [options, setOptions] = useState(column.options.join(', '));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const Icon = COLUMN_TYPE_ICONS[column.type] ?? Type;

  // Re-sync drafts when the saved column changes.
  const savedKey = `${column.name}\n${column.options.join('\n')}`;
  const [lastSaved, setLastSaved] = useState(savedKey);
  if (savedKey !== lastSaved) {
    setLastSaved(savedKey);
    setName(column.name);
    setOptions(column.options.join(', '));
  }

  useEffect(() => {
    if (confirmDelete) cancelRef.current?.focus();
  }, [confirmDelete]);

  const commitName = async () => {
    const v = validateColumnName(name, all, column.id);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setError(null);
    if (v.value === column.name) {
      setName(column.name);
      return;
    }
    const ok = await onPatch(column.id, { name: v.value }, `Renamed to ${v.value}`);
    if (!ok) setName(column.name);
  };

  const commitOptions = async () => {
    const parsed = normalizeOptions(options);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (parsed.value.join('\n') === column.options.join('\n')) return;
    await onPatch(column.id, { options: parsed.value }, 'Options saved');
  };

  const nameId = `col-name-${column.id}`;
  return (
    <li className="flex flex-col gap-2.5 py-3">
      <div className="flex items-center gap-2">
        <span aria-hidden className="w-6 shrink-0 text-right font-mono text-[11px] tabular-nums text-faint">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="relative min-w-0 flex-1">
          <Icon size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <label htmlFor={nameId} className="sr-only">
            Column name
          </label>
          <input
            id={nameId}
            value={name}
            maxLength={MAX_COLUMN_NAME_LENGTH}
            disabled={busy}
            aria-invalid={!!error}
            aria-describedby={error ? `${nameId}-err` : undefined}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitName();
              } else if (e.key === 'Escape' && name !== column.name) {
                e.stopPropagation();
                setName(column.name);
                setError(null);
              }
            }}
            className={cn('field h-9 pl-9', error && 'border-error')}
          />
        </div>
        <select
          aria-label={`Type of ${column.name}`}
          value={column.type}
          disabled={busy}
          onChange={(e) => onPatch(column.id, { type: e.target.value }, `Type changed to ${COLUMN_TYPE_LABELS[e.target.value as ColumnType]}`)}
          className="field h-9 w-[112px] shrink-0 text-[13px]"
        >
          {COLUMN_TYPES.map((t) => (
            <option key={t} value={t}>
              {COLUMN_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <div className="flex shrink-0 items-center">
          <button type="button" aria-label={`Move ${column.name} up`} disabled={busy || index === 0} onClick={() => onPatch(column.id, { order: index - 1 }, `${column.name} moved up`)} className={iconBtn}>
            <ArrowUp size={14} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Move ${column.name} down`}
            disabled={busy || index === total - 1}
            onClick={() => onPatch(column.id, { order: index + 1 }, `${column.name} moved down`)}
            className={iconBtn}
          >
            <ArrowDown size={14} aria-hidden />
          </button>
          <button type="button" aria-label={`Delete ${column.name}`} disabled={busy} onClick={() => setConfirmDelete(true)} className={cn(iconBtn, 'hover:bg-error-bg hover:text-error')}>
            <Trash2 size={14} aria-hidden />
          </button>
        </div>
      </div>
      {error && (
        <p id={`${nameId}-err`} role="alert" className="pl-8 text-xs text-error">
          {error}
        </p>
      )}
      {column.type === 'select' && (
        <div className="flex flex-col pl-8">
          <label htmlFor={`${nameId}-opts`} className="label text-[10px]">
            Options, comma separated
          </label>
          <input
            id={`${nameId}-opts`}
            value={options}
            disabled={busy}
            placeholder="e.g. Todo, Revisit, Done"
            onChange={(e) => setOptions(e.target.value)}
            onBlur={commitOptions}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitOptions();
              }
            }}
            className="field h-9 text-[13px]"
          />
        </div>
      )}
      {confirmDelete && (
        <div role="alertdialog" aria-labelledby={`${nameId}-del`} className="ml-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error-border bg-error-bg px-3 py-2.5">
          <span id={`${nameId}-del`} className="text-[13px] text-error">
            Delete “{column.name}” and its values from every problem? This can&apos;t be undone.
          </span>
          <div className="flex gap-1.5">
            <button ref={cancelRef} type="button" onClick={() => setConfirmDelete(false)} className="btn btn-outline btn-sm">
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                await onDelete(column);
                setConfirmDelete(false);
              }}
              className="btn btn-danger btn-sm"
            >
              Delete column
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function ColumnSettings({ open, onClose, onChanged }: ColumnSettingsProps) {
  const { data, mutate } = useSWR(open ? '/api/columns' : null, fetcher);
  const columns: CustomColumn[] = Array.isArray(data) ? data.map(toCustomColumn).sort((a, b) => a.order - b.order) : [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ColumnType>('text');
  const [newOptions, setNewOptions] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setError(null);
      setStatus('');
    }
  }

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => nameRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      opener?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await mutate();
      setStatus(label);
      onChanged?.();
      return true;
    } catch (caught) {
      const e = failure(caught);
      setError(e?.message || 'Something went wrong');
      await mutate();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onPatch = (id: string, body: Record<string, unknown>, label: string) => run(label, () => send(`/api/columns/${encodeURIComponent(id)}`, 'PATCH', body));
  const onDelete = async (column: CustomColumn) => {
    await run(`Deleted ${column.name}`, () => send(`/api/columns/${encodeURIComponent(column.id)}`, 'DELETE'));
  };

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    const v = validateColumnName(newName, columns);
    if (!v.ok) {
      setError(v.error);
      nameRef.current?.focus();
      return;
    }
    const opts = normalizeOptions(newOptions);
    if (!opts.ok) {
      setError(opts.error);
      return;
    }
    const ok = await run(`Added ${v.value}`, () =>
      send('/api/columns', 'POST', { name: v.value, type: newType, options: newType === 'select' ? opts.value : undefined })
    );
    if (ok) {
      setNewName('');
      setNewOptions('');
      setNewType('text');
      nameRef.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const full = columns.length >= MAX_COLUMNS;

  return createPortal(
    <>
      <div aria-hidden className="overlay animate-in fade-in-0 duration-150" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="column-settings-title"
        onKeyDown={onKeyDown}
        className="modal flex w-[min(600px,calc(100vw-32px))] flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 pb-5 pt-6">
          <div>
            <p className="eyebrow mb-3">
              Columns · {columns.length}/{MAX_COLUMNS}
            </p>
            <h2 id="column-settings-title" className="display text-[40px] text-foreground">
              Custom <em>columns.</em>
            </h2>
            <p className="mt-2 text-[13.5px] text-muted-foreground">Track anything else per problem: company, pattern, a link to your solution.</p>
          </div>
          <button type="button" aria-label="Close column settings" onClick={onClose} className="btn btn-ghost btn-icon -mr-2 shrink-0">
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          <div role="status" aria-live="polite" className="sr-only">
            {busy ? 'Saving' : status}
          </div>
          {error && (
            <div role="alert" className="mt-3 rounded-lg border border-error-border bg-error-bg px-3 py-2 text-[13px] text-error">
              {error}
            </div>
          )}
          {!data ? (
            <p className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground">
              <Loader2 size={14} className="animate-spin" aria-hidden /> Loading columns…
            </p>
          ) : columns.length === 0 ? (
            <p className="py-6 text-[13.5px] text-muted-foreground">No custom columns yet. Add one below.</p>
          ) : (
            <ul aria-label="Custom columns" className="divide-y divide-border">
              {columns.map((c, i) => (
                <ColumnRow key={c.id} column={c} index={i} total={columns.length} all={columns} busy={busy} onPatch={onPatch} onDelete={onDelete} />
              ))}
            </ul>
          )}
          <p className="pb-2 pt-1 text-xs text-faint">
            Renaming keeps every value. Changing the type keeps existing values; ones that don&apos;t fit are shown as plain text.
          </p>
        </div>

        <form onSubmit={onAdd} aria-labelledby="column-add-title" className="flex flex-col gap-3 border-t border-border bg-background/50 px-6 py-5">
          <h3 id="column-add-title" className="label mb-0">
            Add a column
          </h3>
          <div className="flex flex-wrap gap-2">
            <label htmlFor="column-add-name" className="sr-only">
              New column name
            </label>
            <input
              id="column-add-name"
              ref={nameRef}
              value={newName}
              maxLength={MAX_COLUMN_NAME_LENGTH}
              placeholder={full ? `Limit of ${MAX_COLUMNS} reached` : 'Column name, e.g. Company'}
              disabled={busy || full}
              onChange={(e) => setNewName(e.target.value)}
              className="field h-9 min-w-[160px] flex-1"
            />
            <select aria-label="New column type" value={newType} disabled={busy} onChange={(e) => setNewType(e.target.value as ColumnType)} className="field h-9 w-[120px] text-[13px]">
              {COLUMN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {COLUMN_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <button type="submit" disabled={busy || !newName.trim() || full} className="btn btn-primary h-9">
              {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Plus size={14} aria-hidden />}
              Add
            </button>
          </div>
          {newType === 'select' && (
            <div className="flex flex-col">
              <label htmlFor="column-add-options" className="label text-[10px]">
                Options, comma separated
              </label>
              <input
                id="column-add-options"
                value={newOptions}
                disabled={busy}
                placeholder="e.g. Todo, Revisit, Done"
                onChange={(e) => setNewOptions(e.target.value)}
                className="field h-9 text-[13px]"
              />
            </div>
          )}
        </form>
      </div>
    </>,
    document.body
  );
}
