'use client';

// One to-learn item: view, inline edit, and the small forms "Learned it" may need
// (difficulty + link for an unknown problem, a category for a new concept).

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Trash2 } from 'lucide-react';
import { CONCEPT_CATEGORIES } from '@/lib/concepts/library';
import { PlatformLogo } from '@/lib/platforms/logos';
import {
  CODING_PLATFORMS,
  PLATFORM_LABELS,
  STUDY_LIMITS,
  type CodingPlatform,
  type StudyDifficulty,
  type StudyItemWithFlags,
} from '@/lib/study';
import { cn } from '@/lib/utils';
import type { DsaDetails } from './learn';

const DIFFICULTIES: { value: StudyDifficulty; label: string; chip: string }[] = [
  { value: 'EASY', label: 'Easy', chip: 'chip-easy' },
  { value: 'MEDIUM', label: 'Medium', chip: 'chip-medium' },
  { value: 'HARD', label: 'Hard', chip: 'chip-hard' },
];

export const difficultyChip = (d: string | null | undefined) => DIFFICULTIES.find((x) => x.value === d);

/** "Today", "Tomorrow", "Nov 12", "2 days late". */
export function targetLabel(target: string, today: string): string {
  const days = Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 0) return days === -1 ? '1 day late' : `${-days} days late`;
  const d = new Date(`${target}T00:00:00Z`);
  const sameYear = target.slice(0, 4) === today.slice(0, 4);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric', timeZone: 'UTC' });
}

export type RowMode =
  | { type: 'view' }
  | { type: 'edit' }
  | { type: 'details'; prefill: DsaDetails; message?: string }
  | { type: 'category'; message?: string };

type Props = {
  item: StudyItemWithFlags;
  today: string;
  mode: RowMode;
  busy: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onModeChange: (mode: RowMode) => void;
  onLearn: () => void;
  onLearnWithDetails: (details: DsaDetails) => void;
  onLearnWithCategory: (category: string) => void;
  onSave: (patch: Record<string, unknown>) => Promise<boolean>;
  onDelete: () => void;
  onMove: (dir: 'up' | 'down') => void;
};

export function StudyRow(props: Props) {
  const { item, today, mode, busy } = props;
  const isDsa = item.kind === 'DSA';
  const diff = difficultyChip(item.difficulty);
  const late = item.overdue || item.dueToday;

  return (
    <li data-study-row={item.id} className="border-b border-border py-3.5 last:border-b-0">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span className={cn('chip chip-mono mt-0.5 h-[22px] shrink-0 px-2', !isDsa && 'text-foreground')}>{isDsa ? 'DSA' : 'Design'}</span>

        <div className="min-w-0 flex-[1_1_12rem]">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-words text-[15px] font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-ember"
            >
              {item.title}
            </a>
          ) : (
            <span className="break-words text-[15px] font-medium text-foreground">{item.title}</span>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
            {isDsa && item.platform && (
              <span className="inline-flex items-center gap-1.5">
                <PlatformLogo platform={item.platform} size={14} />
                {PLATFORM_LABELS[item.platform]}
              </span>
            )}
            {diff && <span className={cn('chip h-5 px-2 text-[11px]', diff.chip)}>{diff.label}</span>}
            {item.topic && <span className="chip h-5 px-2 text-[11px]">{item.topic}</span>}
            {item.targetDate && (
              <span className={cn('chip chip-mono h-5 px-2 text-[10.5px]', late && 'chip-ember')}>
                <span className="sr-only">Target: </span>
                {targetLabel(item.targetDate, today)}
              </span>
            )}
          </div>
          {item.note && mode.type === 'view' && <p className="mt-1.5 line-clamp-2 text-[13px] text-muted-foreground">{item.note}</p>}
        </div>

        {mode.type === 'view' && (
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              className="btn btn-outline btn-sm mr-1"
              onClick={props.onLearn}
              disabled={busy}
              aria-label={`Learned “${item.title}”`}
            >
              {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Check size={14} strokeWidth={2} aria-hidden />}
              Learned it
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={`Edit “${item.title}”`}
              onClick={() => props.onModeChange({ type: 'edit' })}
              disabled={busy}
            >
              <Pencil size={14} strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm hover:!text-error"
              aria-label={`Delete “${item.title}”`}
              onClick={props.onDelete}
              disabled={busy}
            >
              <Trash2 size={14} strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              data-move={`${item.id}-up`}
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={`Move “${item.title}” up`}
              onClick={() => props.onMove('up')}
              disabled={!props.canMoveUp || busy}
            >
              <ArrowUp size={14} strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              data-move={`${item.id}-down`}
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={`Move “${item.title}” down`}
              onClick={() => props.onMove('down')}
              disabled={!props.canMoveDown || busy}
            >
              <ArrowDown size={14} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        )}
      </div>

      {mode.type === 'edit' && (
        <EditForm item={item} today={today} onCancel={() => props.onModeChange({ type: 'view' })} onSave={props.onSave} />
      )}
      {mode.type === 'details' && (
        <DetailsForm
          prefill={mode.prefill}
          message={mode.message}
          busy={busy}
          onCancel={() => props.onModeChange({ type: 'view' })}
          onSubmit={props.onLearnWithDetails}
        />
      )}
      {mode.type === 'category' && (
        <CategoryForm
          initial={item.topic ?? ''}
          message={mode.message}
          busy={busy}
          onCancel={() => props.onModeChange({ type: 'view' })}
          onSubmit={props.onLearnWithCategory}
        />
      )}
    </li>
  );
}

/** Escape cancels; focus starts on the first field. */
function useInlineForm(onCancel: () => void) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
  }, []);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };
  return { ref, onKeyDown };
}

function FormActions({ busy, submitLabel, onCancel, ember }: { busy?: boolean; submitLabel: string; onCancel: () => void; ember?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
      <button type="submit" className={cn('btn btn-sm', ember ? 'btn-ember' : 'btn-primary')} disabled={busy}>
        {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
        {submitLabel}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
        Cancel
      </button>
      <span className="hidden font-mono text-[11px] text-faint sm:inline">
        <span className="kbd">Esc</span> to cancel
      </span>
    </div>
  );
}

function EditForm({
  item,
  today,
  onCancel,
  onSave,
}: {
  item: StudyItemWithFlags;
  today: string;
  onCancel: () => void;
  onSave: (patch: Record<string, unknown>) => Promise<boolean>;
}) {
  const isDsa = item.kind === 'DSA';
  const [title, setTitle] = useState(item.title);
  const [url, setUrl] = useState(item.url ?? '');
  const [platform, setPlatform] = useState<CodingPlatform | ''>(item.platform ?? '');
  const [difficulty, setDifficulty] = useState<StudyDifficulty | ''>(item.difficulty ?? '');
  const [topic, setTopic] = useState(item.topic ?? '');
  const [targetDate, setTargetDate] = useState(item.targetDate ?? '');
  const [note, setNote] = useState(item.note ?? '');
  const [saving, setSaving] = useState(false);
  const { ref, onKeyDown } = useInlineForm(onCancel);
  const id = useId();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const patch: Record<string, unknown> = { title, url: url || null, topic: topic || null, targetDate: targetDate || null, note: note || null };
    if (isDsa) Object.assign(patch, { platform: platform || null, difficulty: difficulty || null });
    const ok = await onSave(patch);
    setSaving(false);
    if (ok) onCancel();
  };

  return (
    <form ref={ref} onKeyDown={onKeyDown} onSubmit={submit} className="mt-3 grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-2" aria-label={`Edit “${item.title}”`}>
      <Field label="Title" htmlFor={`${id}-title`} wide>
        <input id={`${id}-title`} className="field" value={title} required maxLength={STUDY_LIMITS.title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Link (optional)" htmlFor={`${id}-url`} wide>
        <input id={`${id}-url`} className="field" type="url" inputMode="url" placeholder="https://…" value={url} maxLength={STUDY_LIMITS.url} onChange={(e) => setUrl(e.target.value)} />
      </Field>
      {isDsa && (
        <>
          <Field label="Platform" htmlFor={`${id}-platform`}>
            <select id={`${id}-platform`} className="field" value={platform} onChange={(e) => setPlatform(e.target.value as CodingPlatform | '')}>
              <option value="">Not set</option>
              {CODING_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Difficulty" htmlFor={`${id}-difficulty`}>
            <select id={`${id}-difficulty`} className="field" value={difficulty} onChange={(e) => setDifficulty(e.target.value as StudyDifficulty | '')}>
              <option value="">Not set</option>
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}
      <Field label={isDsa ? 'Topic (optional)' : 'Category (optional)'} htmlFor={`${id}-topic`}>
        {isDsa ? (
          <input id={`${id}-topic`} className="field" value={topic} maxLength={STUDY_LIMITS.topic} placeholder="e.g. Graphs" onChange={(e) => setTopic(e.target.value)} />
        ) : (
          <select id={`${id}-topic`} className="field" value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">Not set</option>
            {CONCEPT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Target date (optional)" htmlFor={`${id}-date`}>
        <input id={`${id}-date`} className="field font-mono text-[13px]" type="date" min={item.targetDate && item.targetDate < today ? item.targetDate : today} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
      </Field>
      <Field label="Note (optional)" htmlFor={`${id}-note`} wide>
        <textarea id={`${id}-note`} className="field" rows={2} value={note} maxLength={STUDY_LIMITS.note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <FormActions busy={saving} submitLabel="Save" onCancel={onCancel} />
    </form>
  );
}

function DetailsForm({
  prefill,
  message,
  busy,
  onCancel,
  onSubmit,
}: {
  prefill: DsaDetails;
  message?: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (d: DsaDetails) => void;
}) {
  const [d, setD] = useState<DsaDetails>(prefill);
  const { ref, onKeyDown } = useInlineForm(onCancel);
  const id = useId();
  const set = (patch: Partial<DsaDetails>) => setD((prev) => ({ ...prev, ...patch }));

  return (
    <form
      ref={ref}
      onKeyDown={onKeyDown}
      onSubmit={(e) => {
        e.preventDefault();
        if (d.title.trim() && d.url.trim() && d.difficulty) onSubmit(d);
      }}
      className="mt-3 grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-2"
      aria-label="Problem details"
    >
      <p className="text-[13px] text-muted-foreground sm:col-span-2" role="note">
        {message && message !== 'Problem not found. Provide title, difficulty, and url manually.'
          ? message
          : 'We couldn’t look this problem up. Add a link and the difficulty to log it.'}
      </p>
      <fieldset className="sm:col-span-2">
        <legend className="label">Difficulty</legend>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTIES.map((x) => (
            <button
              key={x.value}
              type="button"
              aria-pressed={d.difficulty === x.value}
              onClick={() => set({ difficulty: x.value })}
              className={cn('chip h-8 cursor-pointer px-3.5 text-[13px]', d.difficulty === x.value ? x.chip : 'hover:border-border-strong')}
            >
              {x.label}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Title" htmlFor={`${id}-title`}>
        <input id={`${id}-title`} className="field" required maxLength={STUDY_LIMITS.title} value={d.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field label="Link" htmlFor={`${id}-url`}>
        <input id={`${id}-url`} className="field" type="url" required inputMode="url" placeholder="https://…" value={d.url} onChange={(e) => set({ url: e.target.value })} />
      </Field>
      <Field label="Topic (optional)" htmlFor={`${id}-topic`}>
        <input id={`${id}-topic`} className="field" maxLength={STUDY_LIMITS.topic} placeholder="e.g. Graphs" value={d.topic} onChange={(e) => set({ topic: e.target.value })} />
      </Field>
      <FormActions busy={busy} submitLabel="Log as learned" onCancel={onCancel} ember />
    </form>
  );
}

function CategoryForm({
  initial,
  message,
  busy,
  onCancel,
  onSubmit,
}: {
  initial: string;
  message?: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (category: string) => void;
}) {
  const [category, setCategory] = useState((CONCEPT_CATEGORIES as readonly string[]).includes(initial) ? initial : '');
  const { ref, onKeyDown } = useInlineForm(onCancel);
  const id = useId();
  return (
    <form
      ref={ref}
      onKeyDown={onKeyDown}
      onSubmit={(e) => {
        e.preventDefault();
        if (category) onSubmit(category);
      }}
      className="mt-3 grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-2"
      aria-label="Concept category"
    >
      <p className="text-[13px] text-muted-foreground sm:col-span-2" role="note">
        {message ?? 'Pick a category so this concept joins your review schedule.'}
      </p>
      <Field label="Category" htmlFor={`${id}-cat`}>
        <select id={`${id}-cat`} className="field" required value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="" disabled>
            Choose…
          </option>
          {CONCEPT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <FormActions busy={busy} submitLabel="Log as learned" onCancel={onCancel} ember />
    </form>
  );
}

function Field({ label, htmlFor, wide, children }: { label: string; htmlFor: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
    </div>
  );
}
