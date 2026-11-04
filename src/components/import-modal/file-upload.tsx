'use client';

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AlertCircle, FileJson, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { siteConfig } from '@/config/site';
import {
  MAX_BACKUP_BYTES,
  MAX_IMPORT_ROWS,
  MAX_SPREADSHEET_BYTES,
  detectFileType,
  parseBackup,
  parseCsvFile,
  parseExcelFile,
  type BackupParseResult,
  type ParsedFile,
} from '@/lib/import-utils';
import { cn } from '@/lib/utils';

type FileUploadStepProps = {
  onFileParsed: (result: ParsedFile, filename: string) => void;
  onBackupParsed: (backup: Extract<BackupParseResult, { ok: true }>, filename: string) => void;
  onCancel: () => void;
  onBusyChange?: (message: string | null) => void;
};

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

export function FileUploadStep({ onFileParsed, onBackupParsed, onCancel, onBusyChange }: FileUploadStepProps) {
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setError(null);
    const type = detectFileType(file);
    if (type === 'unsupported') {
      setError(`That file type isn't supported. Upload a .csv, .xlsx or .xls file, or a ${siteConfig.name} .json backup.`);
      return;
    }
    const limit = type === 'json' ? MAX_BACKUP_BYTES : MAX_SPREADSHEET_BYTES;
    if (file.size > limit) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The limit is ${mb(limit)}.`);
      return;
    }
    if (file.size === 0) {
      setError('This file is empty.');
      return;
    }
    setParsing(true);
    onBusyChange?.(`Reading ${file.name}`);
    try {
      if (type === 'json') {
        const backup = parseBackup(await file.text());
        if (!backup.ok) {
          setError(backup.error);
          return;
        }
        if (backup.result.valid.length === 0) {
          setError('No valid problems found in this backup.');
          return;
        }
        onBackupParsed(backup, file.name);
        return;
      }
      const parsed = type === 'csv' ? await parseCsvFile(file) : await parseExcelFile(file);
      if (!parsed.headers?.length) {
        setError('No column headers found in the first row.');
        return;
      }
      if (parsed.totalRows === 0) {
        setError('No data rows found below the header row.');
        return;
      }
      if (parsed.totalRows > MAX_IMPORT_ROWS) {
        setError(`Too many rows (${parsed.totalRows.toLocaleString()}). The limit is ${MAX_IMPORT_ROWS.toLocaleString()} per import.`);
        return;
      }
      onFileParsed(parsed, file.name);
    } catch (caught) {
      const err = (caught ?? {}) as { message?: string };
      setError(err?.message || "Couldn't read that spreadsheet.");
    } finally {
      setParsing(false);
      onBusyChange?.(null);
    }
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };
  const pick = () => !parsing && inputRef.current?.click();

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        Bring problems in from a CSV or Excel sheet, or restore a {siteConfig.name} JSON backup with its full review history.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={onInput}
      />

      <div
        role="button"
        tabIndex={0}
        aria-label={`Choose a file to import: CSV, Excel or ${siteConfig.name} JSON backup`}
        aria-describedby="import-file-hint"
        aria-busy={parsing}
        onClick={pick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pick();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          'paper-lines flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed px-6 py-12 text-center transition-colors',
          dragging ? 'border-ember bg-ember-soft' : 'border-border-strong bg-background/60 hover:border-ember/60',
          parsing ? 'cursor-wait' : 'cursor-pointer'
        )}
      >
        <span className={cn('grid size-12 place-items-center rounded-full border bg-card shadow-card', dragging ? 'border-ember text-ember' : 'border-border text-foreground')}>
          {parsing ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Upload size={20} aria-hidden />}
        </span>
        {parsing ? (
          <span className="text-[14px] text-muted-foreground">Reading the file…</span>
        ) : (
          <span className="text-[14px] text-foreground">
            <span className="font-medium underline decoration-ember underline-offset-4">Choose a file</span>
            <span className="text-muted-foreground"> or drop it here</span>
          </span>
        )}
        <span id="import-file-hint" className="font-mono text-[11px] tracking-wide text-faint">
          .csv .xlsx .xls up to {mb(MAX_SPREADSHEET_BYTES)} · .json backup up to {mb(MAX_BACKUP_BYTES)} · {MAX_IMPORT_ROWS.toLocaleString()} rows
        </span>
      </div>

      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
        <div className="flex gap-3 bg-card p-4">
          <FileSpreadsheet size={18} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
          <div className="text-[13px] leading-relaxed text-muted-foreground">
            <span className="block font-medium text-foreground">Spreadsheet</span>
            You&apos;ll match its columns to fields next. Anything else can become a custom column.
          </div>
        </div>
        <div className="flex gap-3 bg-card p-4">
          <FileJson size={18} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
          <div className="text-[13px] leading-relaxed text-muted-foreground">
            <span className="block font-medium text-foreground">JSON backup</span>
            Restores problems, reviews, lists, columns and streak days.
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-error-border bg-error-bg px-3.5 py-2.5 text-[13px] text-error">
          <AlertCircle size={15} aria-hidden className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={onCancel} className="btn btn-outline">
          Cancel
        </button>
      </div>
    </div>
  );
}
