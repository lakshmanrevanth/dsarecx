'use client';

import { useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Plus, Sparkles } from 'lucide-react';
import { siteConfig } from '@/config/site';
import type { ColumnMapping, ParsedFile, RecallField } from '@/lib/import-utils';
import { cn } from '@/lib/utils';

type ColumnMapperStepProps = {
  parsedFile: ParsedFile;
  filename: string;
  initialMapping: ColumnMapping;
  existingCustomColumns?: string[];
  onMappingConfirmed: (mapping: ColumnMapping) => void;
  onBack: () => void;
};

const STANDARD_FIELDS: { value: RecallField; label: string; required?: boolean }[] = [
  { value: 'title', label: 'Title', required: true },
  { value: 'problemNumber', label: 'Problem number' },
  { value: 'platform', label: 'Platform' },
  { value: 'difficulty', label: 'Difficulty' },
  { value: 'topic', label: 'Topic' },
  { value: 'url', label: 'Problem URL' },
  { value: 'dateSolved', label: 'Date solved' },
  { value: 'notes', label: 'Notes' },
  { value: 'code', label: 'Problem code' },
  { value: 'tags', label: 'Tags' },
  { value: 'lists', label: 'Lists' },
  { value: 'isFavorite', label: 'Bookmarked' },
  { value: 'status', label: 'Status' },
  { value: 'currentStep', label: 'Ladder step' },
  { value: 'nextRevisionAt', label: 'Next review' },
  { value: 'revisionCount', label: 'Review count' },
];

const isCustom = (f: string | undefined): f is `custom:${string}` => typeof f === 'string' && f.startsWith('custom:');

function targetLabel(field: RecallField | undefined) {
  if (!field || field === 'skip') return 'Skipped';
  if (isCustom(field)) return `Column · ${field.slice(7)}`;
  return STANDARD_FIELDS.find((f) => f.value === field)?.label ?? field;
}

export function ColumnMapperStep({ parsedFile, filename, initialMapping, existingCustomColumns = [], onMappingConfirmed, onBack }: ColumnMapperStepProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping);
  const [tab, setTab] = useState<'mapping' | 'preview'>('mapping');

  const standard = new Set<RecallField>();
  const custom = new Set<string>();
  for (const f of Object.values(mapping)) {
    if (f === 'skip') continue;
    if (isCustom(f)) custom.add(f.slice(7));
    else standard.add(f);
  }
  const titleMapped = standard.has('title');
  const set = (header: string, field: RecallField) => setMapping((m) => ({ ...m, [header]: field }));
  const unmapped = parsedFile.headers.filter((h) => !mapping[h] || mapping[h] === 'skip');
  const preview = parsedFile.rows.slice(0, 5);

  const mapAllCustom = () =>
    setMapping((m) => {
      const next = { ...m };
      for (const h of parsedFile.headers) if (!next[h] || next[h] === 'skip') next[h] = `custom:${h}` as RecallField;
      return next;
    });
  const resetCustom = () =>
    setMapping((m) => {
      const next = { ...m };
      for (const h of parsedFile.headers) if (isCustom(next[h])) next[h] = 'skip';
      return next;
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[14px] text-muted-foreground">Match each column in your file to a field, make it a custom column, or skip it.</p>
        <p className="font-mono text-[11.5px] text-faint">
          {parsedFile.totalRows.toLocaleString()} rows · <span className="text-foreground">{filename}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border">
        <div role="tablist" aria-label="Mapping view" className="-mb-px flex gap-6">
          {(
            [
              ['mapping', 'Columns', parsedFile.headers.length],
              ['preview', 'Preview', preview.length],
            ] as const
          ).map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-2 border-b-2 pb-2.5 text-[13.5px] transition-colors',
                tab === key ? 'border-ember font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
              <span className="rounded-full bg-muted px-1.5 font-mono text-[10.5px] leading-[18px] text-muted-foreground">{n}</span>
            </button>
          ))}
        </div>
        {tab === 'mapping' && (
          <div className="flex items-center gap-1 pb-1.5">
            {unmapped.length > 0 && (
              <button type="button" onClick={mapAllCustom} className="btn btn-ghost btn-sm">
                <Plus size={13} aria-hidden /> Keep {unmapped.length} as columns
              </button>
            )}
            {custom.size > 0 && (
              <button type="button" onClick={resetCustom} className="btn btn-ghost btn-sm">
                Reset custom
              </button>
            )}
          </div>
        )}
      </div>

      {tab === 'mapping' ? (
        <ul className="max-h-[46vh] divide-y divide-border overflow-y-auto rounded-xl border border-border bg-card">
          {parsedFile.headers.map((header) => {
            const field = mapping[header] || 'skip';
            const auto = initialMapping[header] && initialMapping[header] !== 'skip';
            const customField = isCustom(field);
            const sample = parsedFile.rows.find((r) => r[header])?.[header] ?? '';
            const selectId = `map-${header}`;
            return (
              <li key={header} className={cn('flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4', field === 'skip' && 'bg-background/40')}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor={selectId} className={cn('truncate text-[14px] font-medium', field === 'skip' ? 'text-muted-foreground' : 'text-foreground')}>
                      {header}
                    </label>
                    {auto && <span className="chip chip-mono h-5 px-1.5 text-[9.5px]">Auto</span>}
                    {field === 'skip' && (
                      <button type="button" onClick={() => set(header, `custom:${header}` as RecallField)} className="chip h-5 gap-1 border-dashed px-2 text-[11px] hover:border-ember hover:text-ember">
                        <Plus size={10} aria-hidden /> as column
                      </button>
                    )}
                  </div>
                  {sample && (
                    <p className="mt-0.5 truncate font-mono text-[11.5px] text-faint" title={sample}>
                      e.g. “{sample}”
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <ArrowRight size={13} aria-hidden className="hidden text-faint sm:block" />
                  <select
                    id={selectId}
                    aria-label={`${siteConfig.name} field for column “${header}”`}
                    value={field}
                    onChange={(e) => set(header, e.target.value as RecallField)}
                    className={cn('field h-9 w-full text-[13px] sm:w-[230px]', customField && 'border-ember/50 bg-ember-soft', field === 'skip' && 'text-faint')}
                  >
                    <optgroup label="Fields">
                      {STANDARD_FIELDS.map((opt) => {
                        const taken = opt.value !== field && standard.has(opt.value);
                        return (
                          <option key={opt.value} value={opt.value} disabled={taken}>
                            {opt.label}
                            {opt.required ? ' *' : ''}
                            {taken ? ' (mapped)' : ''}
                          </option>
                        );
                      })}
                    </optgroup>
                    {existingCustomColumns.length > 0 && (
                      <optgroup label="Your columns">
                        {existingCustomColumns.map((c) => (
                          <option key={c} value={`custom:${c}`}>
                            Column · {c}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {!existingCustomColumns.includes(header) && (
                      <optgroup label="New column">
                        <option value={`custom:${header}`}>+ New column “{header}”</option>
                      </optgroup>
                    )}
                    <optgroup label="Ignore">
                      <option value="skip">Don&apos;t import</option>
                    </optgroup>
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="max-h-[46vh] overflow-auto rounded-xl border border-border bg-card">
          <table className="table-paper w-full border-collapse text-[12.5px]">
            <thead className="sticky top-0 bg-card">
              <tr>
                <th className="w-10 px-3 py-2 text-center">#</th>
                {parsedFile.headers.map((h) => {
                  const f = mapping[h] || 'skip';
                  return (
                    <th key={h} className="min-w-[140px] px-3 py-2 align-bottom">
                      <span className="block normal-case tracking-normal text-foreground">{h}</span>
                      <span className={cn('mt-0.5 block text-[9.5px]', f === 'skip' ? 'text-faint' : isCustom(f) ? 'text-ember-strong' : 'text-muted-foreground')}>
                        → {targetLabel(f)}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-center font-mono text-[11px] text-faint">{i + 1}</td>
                  {parsedFile.headers.map((h) => (
                    <td key={h} className={cn('max-w-[220px] truncate px-3 py-2', (mapping[h] || 'skip') === 'skip' ? 'text-faint' : 'text-foreground')} title={row[h]}>
                      {row[h] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!titleMapped && (
        <div role="alert" className="flex items-center gap-2.5 rounded-lg border border-warning-border bg-warning-bg px-3.5 py-2.5 text-[13px] text-warning">
          <AlertCircle size={15} aria-hidden className="shrink-0" />
          Map one column to <strong className="font-semibold">Title</strong> to continue.
        </div>
      )}
      {custom.size > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-ember/25 bg-ember-soft px-3.5 py-2.5 text-[13px] text-foreground">
          <Sparkles size={15} aria-hidden className="mt-0.5 shrink-0 text-ember" />
          <span>
            {custom.size} custom {custom.size === 1 ? 'column' : 'columns'}: <span className="text-muted-foreground">{[...custom].join(', ')}</span>
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="btn btn-outline">
          <ArrowLeft size={15} aria-hidden /> Back
        </button>
        <button type="button" disabled={!titleMapped} onClick={() => onMappingConfirmed(mapping)} className="btn btn-primary">
          Continue <ArrowRight size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}
