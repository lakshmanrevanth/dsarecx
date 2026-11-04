'use client';

// Four-step import: upload (CSV / Excel / JSON backup) → map columns → schedule →
// review (duplicates: Skip / Merge / Overwrite) and import.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { X } from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import {
  SCHEDULE_FIELDS,
  applyStrategy,
  autoDetectMappings,
  hasScheduleData,
  validateAndProcessRows,
  type BackupParseResult,
  type ColumnMapping,
  type DuplicateStrategy,
  type ImportRequestBody,
  type ImportStrategy,
  type ParsedFile,
  type Platform,
  type ValidationResult,
} from '@/lib/import-utils';
import { normalizeLadder } from '@/lib/scheduling';
import { cn } from '@/lib/utils';
import { ColumnMapperStep } from './column-mapper';
import { FileUploadStep } from './file-upload';
import { StrategyPickerStep } from './strategy-picker';
import { ValidationSummaryStep, type ImportResult } from './validation-summary';

export type { ImportResult };

type ImportModalProps = {
  open: boolean;
  onClose: () => void;
  onImportComplete: (result: ImportResult) => void;
};

type Step = 1 | 2 | 3 | 4;

const STEPS: { id: Step; label: string; title: [string, string] }[] = [
  { id: 1, label: 'Upload', title: ['Import', 'problems.'] },
  { id: 2, label: 'Map columns', title: ['Map your', 'columns.'] },
  { id: 3, label: 'Schedule', title: ['Plan the', 'reviews.'] },
  { id: 4, label: 'Review', title: ['Check and', 'import.'] },
];

const PLATFORMS: Platform[] = ['LEETCODE', 'CODEFORCES', 'GFG', 'HACKERRANK', 'CODECHEF'];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ImportModal({ open, onClose, onImportComplete }: ImportModalProps) {
  const { data: rawCols } = useSWR('/api/columns', fetcher);
  const { data: settings } = useSWR('/api/settings', fetcher);
  const existingCustomColumns: string[] = Array.isArray(rawCols) ? rawCols.map((c: { name: string }) => c.name) : [];
  const ladder = normalizeLadder(settings?.preferences?.ladderDays);

  const [step, setStep] = useState<Step>(1);
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [backup, setBackup] = useState<ValidationResult | null>(null);
  const [filename, setFilename] = useState('');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [strategy, setStrategy] = useState<ImportStrategy>('staggered');
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip');
  const [dailyPace, setDailyPace] = useState(5);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const getDefaultPlatform = (): Platform => {
    const pref = settings?.preferences?.defaultPlatform;
    return PLATFORMS.includes(pref) ? pref : 'LEETCODE';
  };

  // Ask before throwing work away (inline, not window.confirm).
  const requestClose = useCallback(() => {
    if ((isImporting || (step > 1 && !importResult)) && !confirmClose) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }, [isImporting, step, importResult, confirmClose, onClose]);

  const goToStep = (next: Step, prefix = '') => {
    setStep(next);
    setConfirmClose(false);
    setAnnouncement(`${prefix ? `${prefix}. ` : ''}Step ${next} of ${STEPS.length}: ${STEPS[next - 1].label}`);
  };

  // Reset when opening (derived-state pattern).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep(1);
      setParsedFile(null);
      setBackup(null);
      setFilename('');
      setColumnMapping({});
      setStrategy('staggered');
      setDuplicateStrategy('skip');
      setDailyPace(5);
      setValidationResult(null);
      setIsValidating(false);
      setIsImporting(false);
      setImportResult(null);
      setImportError(null);
      setAnnouncement('');
      setConfirmClose(false);
    }
  }

  // Focus in on open, back to the opener on close; lock page scroll.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus();
    }, 30);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, [open]);

  // Focus the new step's first control.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus(), 60);
    return () => clearTimeout(t);
  }, [step, open]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      requestClose();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (!items.length) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleFileParsed = (result: ParsedFile, name: string) => {
    setBackup(null);
    setParsedFile(result);
    setFilename(name);
    setColumnMapping(autoDetectMappings(result.headers, existingCustomColumns));
    goToStep(2, `${result.totalRows} rows read from ${name}`);
  };

  const handleBackupParsed = (parsed: Extract<BackupParseResult, { ok: true }>, name: string) => {
    setParsedFile(null);
    setBackup(parsed.result);
    setFilename(name);
    setStrategy('preserve');
    goToStep(3, `Backup with ${parsed.result.valid.length} problems read from ${name}`);
  };

  const handleMappingConfirmed = (mapping: ColumnMapping) => {
    setColumnMapping(mapping);
    const mapsSchedule = Object.values(mapping).some((f) => SCHEDULE_FIELDS.includes(f));
    setStrategy((s) => (mapsSchedule ? 'preserve' : s === 'preserve' ? 'staggered' : s));
    goToStep(3);
  };

  const mappingHasSchedule = Object.values(columnMapping).some((f) => SCHEDULE_FIELDS.includes(f));
  const hasSchedule = backup ? hasScheduleData(backup) : mappingHasSchedule;
  const totalProblems = backup ? backup.valid.length : parsedFile?.totalRows ?? 0;

  const handleStrategyContinue = async () => {
    if (backup) {
      setValidationResult(applyStrategy(backup, strategy, new Date(), dailyPace, ladder));
      goToStep(4, `${backup.valid.length} problems ready`);
      return;
    }
    if (!parsedFile) return;
    setIsValidating(true);
    setAnnouncement(`Checking ${parsedFile.totalRows} rows`);
    try {
      const result = await validateAndProcessRows(parsedFile, columnMapping, strategy, getDefaultPlatform(), new Date(), dailyPace, ladder);
      setValidationResult(result);
      goToStep(4, `${result.valid.length} problems ready, ${result.skipped.length} will be skipped`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!validationResult || validationResult.valid.length === 0) return;
    setIsImporting(true);
    setImportError(null);
    setAnnouncement(`Importing ${validationResult.valid.length} problems, please wait`);
    try {
      const payload: ImportRequestBody = {
        problems: validationResult.valid,
        customColumns: validationResult.customColumns,
        columnDefs: validationResult.columnDefs,
        streakLogs: validationResult.streakLogs,
        studyItems: validationResult.studyItems,
        duplicateStrategy,
      };
      const res = await fetch('/api/problems/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'The server returned an error while importing');
      }
      const data: ImportResult = await res.json();
      setImportResult(data);
      setConfirmClose(false);
      setAnnouncement(
        `Import complete. ${data.imported} imported${data.updated ? `, ${data.updated} updated` : ''}${data.skipped ? `, ${data.skipped} unchanged` : ''}.`
      );
      onImportComplete(data);
    } catch (caught) {
      const err = (caught ?? {}) as { message?: string };
      const msg = err?.message || 'Failed to import problems. Please try again.';
      setImportError(msg);
      setAnnouncement(`Import failed: ${msg}`);
    } finally {
      setIsImporting(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;
  const current = STEPS[step - 1];
  const done = !!importResult;

  return createPortal(
    <>
      <div aria-hidden className="overlay animate-in fade-in-0 duration-200" onClick={requestClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
        aria-describedby="import-modal-step"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn('modal flex flex-col overflow-hidden outline-none transition-[width] duration-200', step === 2 ? 'w-[min(860px,calc(100vw-32px))]' : 'w-[min(600px,calc(100vw-32px))]')}
      >
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>

        {/* Header */}
        <div className="border-b border-border px-6 pb-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p id="import-modal-step" className="eyebrow mb-3">
                Import · {done ? 'Done' : `Step ${step} of ${STEPS.length}`}
              </p>
              <h2 id="import-modal-title" className="display text-[40px] text-foreground">
                {done ? (
                  <>
                    Import <em>complete.</em>
                  </>
                ) : (
                  <>
                    {current.title[0]} <em>{current.title[1]}</em>
                  </>
                )}
              </h2>
            </div>
            <button type="button" onClick={requestClose} aria-label="Close import" className="btn btn-ghost btn-icon -mr-2 shrink-0">
              <X size={16} aria-hidden />
            </button>
          </div>
          <ol aria-label="Progress" className="mt-5 grid grid-cols-4 gap-2">
            {STEPS.map((s) => {
              const state = done || s.id < step ? 'done' : s.id === step ? 'current' : 'todo';
              return (
                <li key={s.id} aria-current={state === 'current' ? 'step' : undefined} className="flex flex-col gap-2">
                  <span className={cn('h-[3px] rounded-full transition-colors', state === 'todo' ? 'bg-border' : state === 'current' ? 'bg-ember' : 'bg-foreground/70')} />
                  <span className={cn('font-mono text-[10px] uppercase tracking-[0.12em]', state === 'todo' ? 'text-faint' : 'text-muted-foreground', state === 'current' && 'text-foreground')}>
                    <span className="hidden sm:inline">({String(s.id).padStart(2, '0')}) </span>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {confirmClose && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-warning-border bg-warning-bg px-6 py-3 text-[13px]">
            <span className="text-foreground">
              {isImporting ? 'The import keeps running in the background. Close anyway?' : 'Discard this import? Nothing has been saved yet.'}
            </span>
            <span className="flex gap-2">
              <button type="button" onClick={() => setConfirmClose(false)} className="btn btn-outline btn-sm">
                Keep going
              </button>
              <button type="button" onClick={onClose} className="btn btn-primary btn-sm">
                {isImporting ? 'Close' : 'Discard'}
              </button>
            </span>
          </div>
        )}

        {/* Body */}
        <div ref={bodyRef} key={step} className="overflow-y-auto px-6 py-6 animate-in fade-in-0 duration-200">
          {step === 1 && (
            <FileUploadStep onFileParsed={handleFileParsed} onBackupParsed={handleBackupParsed} onCancel={onClose} onBusyChange={(msg) => msg && setAnnouncement(msg)} />
          )}
          {step === 2 && parsedFile && (
            <ColumnMapperStep
              parsedFile={parsedFile}
              filename={filename}
              initialMapping={columnMapping}
              existingCustomColumns={existingCustomColumns}
              onMappingConfirmed={handleMappingConfirmed}
              onBack={() => goToStep(1)}
            />
          )}
          {step === 3 && (parsedFile || backup) && (
            <StrategyPickerStep
              strategy={strategy}
              onStrategyChange={setStrategy}
              dailyPace={dailyPace}
              onDailyPaceChange={setDailyPace}
              totalProblems={totalProblems}
              hasSchedule={hasSchedule}
              firstIntervalDays={ladder[0]}
              isBusy={isValidating}
              onContinue={handleStrategyContinue}
              onBack={() => goToStep(backup ? 1 : 2)}
            />
          )}
          {step === 4 && validationResult && (
            <ValidationSummaryStep
              result={validationResult}
              strategy={strategy}
              dailyPace={dailyPace}
              firstIntervalDays={ladder[0]}
              duplicateStrategy={duplicateStrategy}
              onDuplicateStrategyChange={setDuplicateStrategy}
              isBackup={!!backup}
              isImporting={isImporting}
              importResult={importResult}
              importError={importError}
              onImport={handleImport}
              onBack={() => goToStep(3)}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
