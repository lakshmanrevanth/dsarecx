'use client';

// Side panel for the fields that don't fit in a cell: title, URL, platform/code,
// difficulty, solve date, next review, topic, tags, notes and recall questions.

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSWRConfig } from 'swr';
import { ArrowUpRight, Loader2, Sparkles, Trash2, X } from 'lucide-react';
import { PlatformLogo } from '@/lib/platforms/logos';
import { displayCode, isHttpUrl, toLocalDateInput } from '@/lib/platforms/problem-input';
import { cn } from '@/lib/utils';
import { diffEditorForm, toEditorForm, type EditorForm, type ProblemPatch } from './editor-form';
import { DEFAULT_TOPICS, DIFFICULTIES, KeyHints, PLATFORM_LABELS, PLATFORM_OPTIONS, StatusBadge, cap, failure, problemIdentifier, type Json } from './shared';
import { mergeSuggestions, topicsFrom, useCachedProblems } from './suggestions';
import { TagEditor } from './tag-input';

export type { ProblemPatch };

export class ProblemPatchError extends Error {
  constructor(message: string, public status: number, public existingId?: string | null) {
    super(message);
  }
}

const isDailyKey = (key: unknown) =>
  typeof key === 'string' && (key.startsWith('/api/daily') || key.startsWith('/api/problems/due') || key === '/api/concepts');

/** PATCH with an optimistic update of the '/api/problems' cache. Throws ProblemPatchError. */
export function useProblemPatch() {
  const { mutate } = useSWRConfig();
  return useCallback(
    async (id: string, patch: ProblemPatch) => {
      mutate('/api/problems', (prev: Json[] | undefined) => prev?.map((p) => (p.id === id ? { ...p, ...patch } : p)), { revalidate: false });
      let res: Response;
      try {
        res = await fetch(`/api/problems/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
      } catch {
        mutate('/api/problems');
        throw new ProblemPatchError('Network error. Changes not saved.', 0);
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        mutate('/api/problems');
        throw new ProblemPatchError(json.error ?? 'Failed to save changes', res.status, json.existingId);
      }
      if (json.problem) {
        // Server-computed fields (e.g. nextRevisionAt after a solve-date change).
        mutate('/api/problems', (prev: Json[] | undefined) => prev?.map((p) => (p.id === id ? { ...p, ...json.problem } : p)), { revalidate: false });
      }
      if (patch.nextRevisionOn || patch.dateSolved) mutate(isDailyKey);
    },
    [mutate]
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const MAX_QUESTIONS = 5;

const questionsText = (p: Json) => (Array.isArray(p?.recallQuestions) ? (p.recallQuestions as string[]).join('\n') : '');
const toQuestions = (text: string) =>
  text
    .split('\n')
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, MAX_QUESTIONS);

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border px-5 py-5 sm:px-6">
      <h3 className="eyebrow eyebrow-plain mb-4 text-[10.5px]">
        <span className="text-faint">({n})</span> {title}
      </h3>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function F({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="label">
          {label}
        </label>
      ) : (
        <span className="label">{label}</span>
      )}
      {children}
      {hint && <span className="mt-1.5 text-xs text-faint">{hint}</span>}
    </div>
  );
}

export function ProblemEditor({
  problem,
  onClose,
  onSave,
  onJumpToProblem,
  onDelete,
}: {
  problem: Json;
  onClose: () => void;
  onSave?: (id: string, patch: ProblemPatch) => Promise<void>;
  onJumpToProblem?: (id: string) => void;
  /** Deletes this problem (the table shows an Undo toast). */
  onDelete?: (id: string) => void;
}) {
  const { mutate } = useSWRConfig();
  const fallbackSave = useProblemPatch();
  const save = onSave ?? fallbackSave;
  const [initial] = useState(() => toEditorForm(problem));
  const [form, setForm] = useState<EditorForm>(initial);
  const [savedQuestions, setSavedQuestions] = useState(() => questionsText(problem));
  const [questions, setQuestions] = useState(savedQuestions);
  const [aiState, setAiState] = useState<'idle' | 'busy' | 'unavailable'>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const cached = useCachedProblems();
  const topicOptions = mergeSuggestions(topicsFrom(cached), DEFAULT_TOPICS);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || questions.trim() !== savedQuestions.trim();
  const isConcept = problem.platform === 'SYSTEM_DESIGN';
  const isLeetCode = form.platform === 'LEETCODE';
  const ident = problemIdentifier(problem, displayCode(problem));

  const set = <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
    setConfirmDiscard(false);
  };

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => titleRef.current?.focus(), 30);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);

  const requestClose = () => {
    if (dirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const refreshQuestionCaches = () =>
    mutate((key: unknown) => typeof key === 'string' && (isDailyKey(key) || key.startsWith('/api/problems')), undefined, { revalidate: true });

  const putQuestions = async (list: string[]) => {
    const res = await fetch(`/api/problems/${problem.id}/questions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: list }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? 'Could not save recall questions');
    return (Array.isArray(json.questions) ? json.questions : list) as string[];
  };

  const generateQuestions = async () => {
    setAiState('busy');
    setError('');
    try {
      const res = await fetch(`/api/problems/${problem.id}/questions`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (res.status === 503 && json.code === 'AI_NOT_CONFIGURED') {
        setAiState('unavailable');
        return;
      }
      if (!res.ok) throw new Error(json.error ?? 'Could not generate questions');
      const text = (json.questions as string[]).join('\n');
      setQuestions(text);
      setSavedQuestions(text); // the server saved them
      refreshQuestionCaches();
      setAiState('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate questions');
      setAiState('idle');
    }
  };

  const handleSave = async () => {
    if (saving) return;
    const result = diffEditorForm(initial, form);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    const questionsChanged = questions.trim() !== savedQuestions.trim();
    if (Object.keys(result.patch).length === 0 && !questionsChanged) {
      onClose();
      return;
    }
    setSaving(true);
    setError('');
    setDuplicateId(null);
    try {
      if (Object.keys(result.patch).length) await save(problem.id, result.patch);
      if (questionsChanged) {
        const saved = await putQuestions(toQuestions(questions));
        setSavedQuestions(saved.join('\n'));
        refreshQuestionCaches();
      }
      onClose();
    } catch (caught) {
      const e = failure(caught);
      setError(e?.message ?? 'Failed to save changes');
      if (e?.status === 409 && e.existingId) setDuplicateId(e.existingId);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if ((e.target as HTMLElement).closest?.('[data-popover]')) return;
      e.preventDefault();
      e.stopPropagation();
      requestClose();
      return;
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
      return;
    }
    if (e.key === 'Tab' && panelRef.current) {
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
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
    }
  };
  const enterSaves = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const dateChanged = form.solvedOn !== initial.solvedOn;
  const questionCount = toQuestions(questions).length;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div data-problem-editor onKeyDown={onKeyDown}>
      <div aria-hidden className="overlay animate-in fade-in-0 duration-200" onMouseDown={requestClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-heading`}
        className="fixed inset-y-0 right-0 z-[81] flex w-full flex-col border-l border-border bg-card shadow-pop animate-in slide-in-from-right-8 fade-in-0 duration-200 sm:w-[480px]"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-border px-5 pb-4 pt-5 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-3">
              Edit · {PLATFORM_LABELS[problem.platform] ?? problem.platform}
              {ident ? ` · ${ident}` : ''}
            </p>
            <h2 id={`${uid}-heading`} className="display line-clamp-2 text-3xl leading-[1.05] text-foreground">
              {form.title.trim() || problem.title}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge problem={problem} />
              {isHttpUrl(form.url) && (
                <a href={form.url} target="_blank" rel="noopener noreferrer" className="link-underline text-xs text-muted-foreground">
                  Open problem <ArrowUpRight size={12} aria-hidden />
                </a>
              )}
            </div>
          </div>
          <button type="button" onClick={requestClose} aria-label="Close editor" className="btn btn-ghost btn-icon -mr-2 -mt-1 shrink-0">
            <X size={16} aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <Section n="01" title="Details">
            <F label="Title" htmlFor={`${uid}-title`}>
              <input
                id={`${uid}-title`}
                ref={titleRef}
                className="field"
                value={form.title}
                maxLength={300}
                onChange={(e) => set('title', e.target.value)}
                onKeyDown={enterSaves}
              />
            </F>
            <F label="URL" htmlFor={`${uid}-url`}>
              <input
                id={`${uid}-url`}
                className={cn('field font-mono text-[12.5px]', form.url.trim() && !isHttpUrl(form.url) && 'border-error')}
                type="url"
                inputMode="url"
                value={form.url}
                aria-invalid={!!form.url.trim() && !isHttpUrl(form.url)}
                onChange={(e) => set('url', e.target.value)}
                onKeyDown={enterSaves}
              />
            </F>
            {/* Concepts are identified by their library / path code, which tracks path progress. */}
            {!isConcept && (
              <div className="grid grid-cols-2 gap-3">
                <F label="Platform" htmlFor={`${uid}-platform`}>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                      <PlatformLogo platform={form.platform} size={16} />
                    </span>
                    <select
                      id={`${uid}-platform`}
                      className="field pl-9"
                      value={form.platform}
                      onChange={(e) => set('platform', e.target.value)}
                      onKeyDown={enterSaves}
                    >
                      {PLATFORM_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </F>
                <F label={isLeetCode ? 'Number' : 'Code'} htmlFor={`${uid}-ident`}>
                  <input
                    id={`${uid}-ident`}
                    className="field font-mono"
                    value={form.identifier}
                    inputMode={isLeetCode ? 'numeric' : 'text'}
                    placeholder={isLeetCode ? 'e.g. 1' : form.platform === 'CODEFORCES' ? 'e.g. 1234A' : 'optional'}
                    onChange={(e) => set('identifier', e.target.value)}
                    onKeyDown={enterSaves}
                  />
                </F>
              </div>
            )}
          </Section>

          <Section n="02" title="Schedule">
            <F label="Difficulty">
              <div role="radiogroup" aria-label="Difficulty" className="flex flex-wrap gap-1.5">
                {DIFFICULTIES.map((d) => {
                  const on = form.difficulty === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set('difficulty', d)}
                      className={cn(
                        'chip h-8 cursor-pointer px-3.5 text-[13px] transition-all',
                        on ? `chip-${d.toLowerCase()} ring-1 ring-current/40` : 'text-muted-foreground hover:border-border-strong'
                      )}
                    >
                      {cap(d)}
                    </button>
                  );
                })}
              </div>
            </F>
            <div className="grid grid-cols-2 gap-3">
              <F
                label="Solved on"
                htmlFor={`${uid}-solved`}
                hint={dateChanged ? (problem.revisionCount > 0 ? 'Already reviewed; the schedule stays.' : 'First review moves to match.') : undefined}
              >
                <input
                  id={`${uid}-solved`}
                  className="field font-mono text-[13px]"
                  type="date"
                  value={form.solvedOn}
                  max={toLocalDateInput()}
                  onChange={(e) => set('solvedOn', e.target.value)}
                  onKeyDown={enterSaves}
                />
              </F>
              {initial.nextReviewOn && (
                <F
                  label={problem.status === 'MASTERED' ? 'Next recheck' : 'Next review'}
                  htmlFor={`${uid}-next`}
                  hint={form.nextReviewOn !== initial.nextReviewOn ? 'Moves the date only; no review is logged.' : undefined}
                >
                  <input
                    id={`${uid}-next`}
                    className="field font-mono text-[13px]"
                    type="date"
                    value={form.nextReviewOn}
                    min={toLocalDateInput()}
                    onChange={(e) => set('nextReviewOn', e.target.value)}
                    onKeyDown={enterSaves}
                  />
                </F>
              )}
            </div>
          </Section>

          <Section n="03" title="Organize">
            <F label="Topic" htmlFor={`${uid}-topic`} hint="The main topic. Use tags for everything else.">
              <input
                id={`${uid}-topic`}
                className="field"
                value={form.topic}
                list={`${uid}-topics`}
                onChange={(e) => set('topic', e.target.value)}
                onKeyDown={enterSaves}
              />
              <datalist id={`${uid}-topics`}>
                {topicOptions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </F>
            <F label="Tags" htmlFor={`${uid}-tags`} hint="Up to 10, e.g. Blind 75, revisit, interview.">
              <TagEditor id={`${uid}-tags`} tags={form.tags} onChange={(t) => set('tags', t)} onSubmit={handleSave} onEscape={requestClose} />
            </F>
          </Section>

          <Section n="04" title="Notes">
            <F label="Your notes" htmlFor={`${uid}-notes`} hint="The approach in your own words. Shown when you reveal notes in a review.">
              <textarea
                id={`${uid}-notes`}
                className="field min-h-[120px]"
                value={form.notes}
                rows={5}
                onChange={(e) => set('notes', e.target.value)}
              />
            </F>
          </Section>

          <Section n="05" title="Recall questions">
            <F
              label={`Questions · ${questionCount}/${MAX_QUESTIONS}`}
              htmlFor={`${uid}-questions`}
              hint="One per line. Asked before your notes are revealed in a review."
            >
              <textarea
                id={`${uid}-questions`}
                className="field min-h-[96px]"
                value={questions}
                rows={4}
                placeholder={'What is the invariant?\nWhy is the greedy choice safe?'}
                onChange={(e) => {
                  setQuestions(e.target.value);
                  setConfirmDiscard(false);
                }}
              />
            </F>
            {aiState === 'unavailable' ? (
              <p className="text-xs text-faint">AI questions aren&apos;t set up on this server. Write your own above.</p>
            ) : (
              <button type="button" onClick={generateQuestions} disabled={aiState === 'busy'} className="btn btn-outline btn-sm self-start">
                {aiState === 'busy' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Sparkles size={14} aria-hidden />}
                {aiState === 'busy' ? 'Writing questions…' : questionCount ? 'Regenerate with AI' : 'Generate with AI'}
              </button>
            )}
          </Section>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-border bg-card px-5 py-4 sm:px-6">
          {error && (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-error-border bg-error-bg px-3 py-2 text-[13px] text-error">
              <span>{error}</span>
              {duplicateId && onJumpToProblem && (
                <button
                  type="button"
                  className="font-medium underline underline-offset-2"
                  onClick={() => {
                    onClose();
                    onJumpToProblem(duplicateId);
                  }}
                >
                  Jump to it
                </button>
              )}
            </div>
          )}
          {confirmDiscard && (
            <p role="alert" className="text-[13px] text-muted-foreground">
              Discard your changes? Press <kbd className="kbd">Esc</kbd> again or choose Discard.
            </p>
          )}
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(problem.id);
                }}
                aria-label={`Delete ${problem.title}`}
                className="btn btn-ghost btn-sm text-error hover:bg-error-bg hover:text-error"
              >
                <Trash2 size={14} aria-hidden /> Delete
              </button>
            )}
            <KeyHints className="mr-auto ml-1" items={[['Enter', 'save'], ['Esc', 'close']]} />
            <span className="flex-1 md:hidden" />
            <button type="button" onClick={requestClose} className="btn btn-outline btn-sm">
              {confirmDiscard ? 'Discard' : 'Cancel'}
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
              {saving && <Loader2 size={14} className="animate-spin" aria-hidden />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
