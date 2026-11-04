'use client';

import { useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Loader2 } from 'lucide-react';
import { siteConfig } from '@/config/site';
import type { DuplicateStrategy, ImportStrategy, ValidationResult } from '@/lib/import-utils';
import { cn } from '@/lib/utils';

export type ImportResult = {
  imported: number;
  skipped: number;
  total: number;
  updated?: number;
  customColumnsCreated?: string[];
  listsCreated?: string[];
  revisionsImported?: number;
  streakDaysImported?: number;
};

const DUPLICATE_OPTIONS: { value: DuplicateStrategy; label: string; hint: string }[] = [
  { value: 'skip', label: 'Skip', hint: 'Leave problems you already track untouched.' },
  { value: 'merge', label: 'Merge', hint: 'Fill empty fields, combine tags and lists, keep whichever schedule is further along.' },
  { value: 'overwrite', label: 'Overwrite', hint: 'Replace details and schedule with the imported values.' },
];

type Props = {
  result: ValidationResult;
  strategy: ImportStrategy;
  dailyPace?: number;
  firstIntervalDays?: number;
  duplicateStrategy: DuplicateStrategy;
  onDuplicateStrategyChange: (s: DuplicateStrategy) => void;
  isBackup?: boolean;
  isImporting: boolean;
  importResult: ImportResult | null;
  importError: string | null;
  onImport: () => void;
  onBack: () => void;
  onClose: () => void;
};

function Stat({ n, label, tone }: { n: number; label: string; tone?: 'ember' | 'warn' | 'muted' }) {
  return (
    <div className="flex flex-col gap-1 bg-card px-4 py-3.5">
      <span className={cn('font-serif text-[34px] leading-none tabular-nums', tone === 'ember' ? 'text-ember' : tone === 'warn' ? 'text-warning' : 'text-foreground', tone === 'muted' && 'text-muted-foreground')}>
        {n.toLocaleString()}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{label}</span>
    </div>
  );
}

function Collapsible({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left text-[13px] text-foreground hover:bg-muted/50">
        {title}
        <span className="flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-wider text-faint">
          {open ? 'Hide' : 'Show'}
          <ChevronDown size={13} aria-hidden className={cn('transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && (
        <ul id={id} className="max-h-32 overflow-y-auto px-4 pb-3 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
          {children}
        </ul>
      )}
    </div>
  );
}

export function ValidationSummaryStep({
  result,
  strategy,
  dailyPace = 5,
  firstIntervalDays = 3,
  duplicateStrategy,
  onDuplicateStrategyChange,
  isBackup = false,
  isImporting,
  importResult,
  importError,
  onImport,
  onBack,
  onClose,
}: Props) {
  const warningCounts: Record<string, number> = {};
  for (const w of result.warnings) {
    const msg = w.message.replace(/^Row \d+:\s*/, '');
    warningCounts[msg] = (warningCounts[msg] || 0) + 1;
  }
  const strategyLabel =
    strategy === 'staggered'
      ? `Spread out, ~${dailyPace} a day`
      : strategy === 'fresh'
        ? `Start fresh, first review ${firstIntervalDays} days after solving`
        : strategy === 'preserve'
          ? 'Keep the schedule from the file'
          : 'Mastered, rechecks later';
  const revisionTotal = result.valid.reduce((n, p) => n + (p.revisions?.length ?? 0), 0);
  const listTotal = new Set(result.valid.flatMap((p) => p.lists ?? []).map((l) => l.toLowerCase())).size;

  if (importResult) {
    const lines = [
      importResult.customColumnsCreated?.length ? `Columns created: ${importResult.customColumnsCreated.join(', ')}` : null,
      importResult.listsCreated?.length ? `Lists created: ${importResult.listsCreated.join(', ')}` : null,
      (importResult.revisionsImported ?? 0) > 0
        ? `${(importResult.revisionsImported ?? 0).toLocaleString()} past reviews restored${importResult.streakDaysImported ? `, ${importResult.streakDaysImported} streak days` : ''}`
        : null,
      importResult.skipped > 0 ? `${importResult.skipped} already tracked or duplicated, left unchanged` : null,
    ].filter(Boolean) as string[];
    return (
      <div className="flex flex-col gap-5">
        <p className="text-[14px] text-muted-foreground">Your problems are in your {siteConfig.name} ledger.</p>
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
          <Stat n={importResult.imported} label="Imported" tone="ember" />
          <Stat n={importResult.updated ?? 0} label="Updated" />
          <Stat n={importResult.skipped} label="Unchanged" tone="muted" />
        </div>
        {lines.length > 0 && (
          <ul className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
            {lines.map((l) => (
              <li key={l} className="flex items-start gap-2">
                <Check size={14} aria-hidden className="mt-0.5 shrink-0 text-success" />
                {l}
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={onClose} autoFocus className="btn btn-primary">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-3 gap-px bg-border">
          <Stat n={result.valid.length} label="Ready" tone="ember" />
          <Stat n={result.warnings.length} label="Warnings" tone={result.warnings.length ? 'warn' : 'muted'} />
          <Stat n={result.skipped.length} label="Skipped" tone="muted" />
        </div>
        <div className="flex flex-col gap-1 border-t border-border px-4 py-3 text-[13px]">
          <span className="text-muted-foreground">
            Schedule: <span className="text-foreground">{strategyLabel}</span>
          </span>
          {isBackup && (revisionTotal > 0 || listTotal > 0 || (result.streakLogs?.length ?? 0) > 0) && (
            <span className="text-muted-foreground">
              Also restores {revisionTotal.toLocaleString()} reviews, {listTotal} lists
              {result.streakLogs?.length ? ` and ${result.streakLogs.length} streak days` : ''}.
            </span>
          )}
        </div>
        {result.customColumns?.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
            <span className="text-[13px] text-muted-foreground">
              {result.customColumns.length} custom {result.customColumns.length === 1 ? 'column' : 'columns'} will be created
            </span>
            <div className="flex flex-wrap gap-1.5">
              {result.customColumns.map((c) => (
                <span key={c} className="chip chip-ember">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
        {result.warnings.length > 0 && (
          <Collapsible id="import-warnings" title={`${result.warnings.length} warnings, filled with defaults`}>
            {Object.entries(warningCounts).map(([msg, n]) => (
              <li key={msg}>
                {n}× {msg}
              </li>
            ))}
          </Collapsible>
        )}
        {result.skipped.length > 0 && (
          <Collapsible id="import-skipped" title={`${result.skipped.length} rows will be skipped`}>
            {result.skipped.map((s, i) => (
              <li key={i}>
                Row {s.row}: {s.reason.replace(/^Row \d+:\s*/, '')}
              </li>
            ))}
          </Collapsible>
        )}
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="label mb-2.5">Already tracked (same platform and number)</legend>
        <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-full border border-border bg-background/60 p-1">
          {DUPLICATE_OPTIONS.map((opt) => {
            const on = duplicateStrategy === opt.value;
            return (
              <label
                key={opt.value}
                className={cn(
                  'flex h-8 cursor-pointer items-center justify-center rounded-full text-[13px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                  on ? 'bg-foreground font-medium text-background' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <input
                  type="radio"
                  name="import-duplicate-strategy"
                  value={opt.value}
                  checked={on}
                  disabled={isImporting}
                  aria-describedby="import-duplicate-hint"
                  onChange={() => onDuplicateStrategyChange(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            );
          })}
        </div>
        <p id="import-duplicate-hint" className="text-[12.5px] text-faint">
          {DUPLICATE_OPTIONS.find((o) => o.value === duplicateStrategy)?.hint}
        </p>
      </fieldset>

      {importError && (
        <div role="alert" className="rounded-lg border border-error-border bg-error-bg px-3.5 py-2.5 text-[13px] text-error">
          {importError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button type="button" disabled={isImporting} onClick={onBack} className="btn btn-outline">
          <ArrowLeft size={15} aria-hidden /> Back
        </button>
        <button type="button" disabled={isImporting || result.valid.length === 0} onClick={onImport} className="btn btn-ember">
          {isImporting ? (
            <>
              <Loader2 size={15} className="animate-spin" aria-hidden /> Importing…
            </>
          ) : (
            <>
              Import {result.valid.length.toLocaleString()} {result.valid.length === 1 ? 'problem' : 'problems'} <ArrowRight size={15} aria-hidden />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
