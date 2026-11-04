'use client';

// Click-to-create draft: look the problem up (number, code or URL) or enter it by
// hand, edit every field, then save. Nothing is saved until Save / Enter; Esc asks
// before throwing a draft away. <NewRow> is the desktop table version,
// <NewProblemCard> the stacked phone version; both share useProblemDraft.

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { ChevronDown, CornerDownLeft, Loader2, Search, X } from 'lucide-react';
import { DropdownMenu, MenuRadioItem } from '@/components/ui/dropdown-menu';
import { PlatformLogo } from '@/lib/platforms/logos';
import { isHttpUrl, localDateInputToISO, toLocalDateInput } from '@/lib/platforms/problem-input';
import { cn } from '@/lib/utils';
import { DifficultyPickerCell, InlineTextCell, TopicPickerCell } from './cells';
import { CustomCell } from './custom-cell';
import { findDuplicate, lookupProblem, manualPrefill, type LookupData } from './lookup';
import { DEFAULT_TOPICS, DIFFICULTIES, KeyHints, PLATFORM_OPTIONS, cap, failure, type Json } from './shared';
import { mergeSuggestions, topicsFrom, useCachedProblems } from './suggestions';
import { TagEditor } from './tag-input';

export type NewProblemPayload = {
  platform: string;
  problemNumber: number;
  title: string;
  difficulty: string;
  topic: string;
  url: string;
  code?: string;
  notes?: string;
  customFields?: Record<string, string>;
  tags?: string[];
  dateSolved: string;
};

export type NewRowProps = {
  /** Should throw on failure. For duplicates, attach `status: 409` and `existingId` to the error. */
  onSave: (data: NewProblemPayload) => Promise<void>;
  onCancel: () => void;
  columns: Json[];
  /** Scroll to + highlight an existing row ("Already tracked · jump to row"). */
  onJumpToProblem?: (id: string) => void;
  /** Overrides the user's default platform from settings. */
  defaultPlatform?: string;
};

type Draft = {
  manual: boolean;
  title: string;
  url: string;
  difficulty: string;
  topic: string;
  tags: string[];
  solvedOn: string;
  notes: string;
  customFields: Record<string, string>;
  problemNumber?: number;
  code?: string;
};

const PLACEHOLDERS: Record<string, string> = {
  LEETCODE: 'Number or URL, e.g. 146',
  CODEFORCES: 'Code or URL, e.g. 4A',
  CODECHEF: 'Code or URL, e.g. FLOW001',
  GFG: 'Paste a GFG problem URL',
  HACKERRANK: 'Paste a HackerRank URL',
};

type LookupState = { state: 'idle' | 'loading' | 'not_found' | 'error'; message?: string };

type DraftRefs = { queryRef: RefObject<HTMLInputElement | null>; titleRef: RefObject<HTMLInputElement | null> };

function useProblemDraft(
  { onSave, onCancel, onJumpToProblem, defaultPlatform }: Omit<NewRowProps, 'columns'>,
  { queryRef, titleRef }: DraftRefs
) {
  const [platform, setPlatform] = useState(defaultPlatform ?? 'LEETCODE');
  const platformTouched = useRef(!!defaultPlatform);
  const [query, setQuery] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ state: 'idle' });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState<{ id: string; title?: string } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const cached = useCachedProblems();
  const live = useRef({ draft, dirty, confirmDiscard, query });
  useEffect(() => {
    live.current = { draft, dirty, confirmDiscard, query };
  }, [draft, dirty, confirmDiscard, query]);

  // The user's default platform (unless they already picked one).
  useEffect(() => {
    if (defaultPlatform) return;
    let alive = true;
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const p = json?.preferences?.defaultPlatform;
        if (alive && !platformTouched.current && PLATFORM_OPTIONS.some((o) => o.value === p)) setPlatform(p);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [defaultPlatform]);

  useEffect(() => {
    const t = setTimeout(() => queryRef.current?.focus({ preventScroll: true }), 30);
    return () => clearTimeout(t);
  }, [queryRef]);

  // Esc: ask before discarding a touched draft, otherwise cancel. Popovers and cell
  // editors handle their own Esc.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[data-popover]') || document.querySelector('[data-problem-editor]') || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-draft-cell]') && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
      e.preventDefault();
      const { draft: d, dirty: isDirty, confirmDiscard: confirming, query: q } = live.current;
      if (((d && isDirty) || (!d && q.trim())) && !confirming) {
        setConfirmDiscard(true);
        return;
      }
      onCancel();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  const choosePlatform = (p: string) => {
    platformTouched.current = true;
    setPlatform(p);
    setDraft(null);
    setLookup({ state: 'idle' });
    setDuplicate(null);
    setError('');
    setConfirmDiscard(false);
    setTimeout(() => queryRef.current?.focus(), 30);
  };

  const startDraft = (data: LookupData | null) => {
    const pre = manualPrefill(platform, query);
    const d: Draft = {
      manual: !data,
      title: data?.title ?? '',
      url: data?.url ?? pre.url,
      difficulty: data?.difficulty ?? '',
      topic: data?.topic ?? '',
      tags: [],
      solvedOn: toLocalDateInput(),
      notes: '',
      customFields: {},
      problemNumber: data?.problemNumber ?? pre.problemNumber,
      code: data?.code ?? (platform !== 'LEETCODE' ? pre.code : undefined),
    };
    setDraft(d);
    setDirty(false);
    setError('');
    setConfirmDiscard(false);
    setLookup({ state: 'idle' });
    setDuplicate(findDuplicate(cached, platform, d));
    setTimeout(() => titleRef.current?.focus(), 30);
  };

  const doLookup = async () => {
    const q = query.trim();
    if (!q || lookup.state === 'loading') return;
    setLookup({ state: 'loading' });
    setError('');
    setConfirmDiscard(false);
    const r = await lookupProblem(platform, q);
    if (r.status === 'found') startDraft(r.data);
    else if (r.status === 'not_found') setLookup({ state: 'not_found' });
    else setLookup({ state: 'error', message: r.message });
  };

  const patch = useCallback((p: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...p } : d));
    setDirty(true);
    setError('');
    setConfirmDiscard(false);
  }, []);

  const backToLookup = () => {
    setDraft(null);
    setDuplicate(null);
    setError('');
    setConfirmDiscard(false);
    setTimeout(() => queryRef.current?.focus(), 30);
  };

  const jumpTo = (id: string) => {
    if (onJumpToProblem) onJumpToProblem(id);
    onCancel();
  };

  const save = async () => {
    if (!draft || saving) return;
    const title = draft.title.trim();
    const url = draft.url.trim();
    if (!title) return setError('Title is required.');
    if (!isHttpUrl(url)) return setError('Enter the problem URL (http:// or https://).');
    if (!draft.difficulty) return setError('Pick a difficulty.');
    if (!draft.solvedOn || draft.solvedOn > toLocalDateInput()) return setError("Solve date can't be in the future.");
    const custom = Object.fromEntries(Object.entries(draft.customFields).filter(([, v]) => v.trim()));
    setSaving(true);
    setError('');
    try {
      await onSave({
        platform,
        problemNumber: draft.problemNumber ?? 0,
        code: draft.code,
        title,
        difficulty: draft.difficulty,
        topic: draft.topic.trim(),
        url,
        notes: draft.notes.trim() || undefined,
        customFields: Object.keys(custom).length ? custom : undefined,
        tags: draft.tags,
        dateSolved: localDateInputToISO(draft.solvedOn),
      });
    } catch (caught) {
      const e = failure(caught);
      const msg: string = e?.message ?? 'Failed to save problem';
      if (e?.status === 409 || /already/i.test(msg)) {
        const id = e?.existingId ?? findDuplicate(cached, platform, draft)?.id;
        if (id) setDuplicate({ id });
        else setError('Already tracked.');
      } else setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const enterSaves = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  };

  const platformLabel = PLATFORM_OPTIONS.find((p) => p.value === platform)?.label ?? platform;
  const identLabel = draft?.code ?? (draft?.problemNumber && draft.problemNumber < 100000 ? String(draft.problemNumber) : null);

  return {
    platform, platformLabel, choosePlatform, query, setQuery, lookup, setLookup, doLookup, draft, patch, startDraft, backToLookup,
    saving, error, duplicate, confirmDiscard, setConfirmDiscard, save, enterSaves, jumpTo, identLabel, onCancel,
  };
}

type DraftApi = ReturnType<typeof useProblemDraft>;

// ───────── Pieces shared by both layouts ─────────

function PlatformPicker({ api, showLabel = false }: { api: DraftApi; showLabel?: boolean }) {
  return (
    <DropdownMenu
      label="Platform"
      width={200}
      trigger={(props) => (
        <button
          {...props}
          data-platform-select-btn
          aria-label={`Platform: ${api.platformLabel}. Change platform`}
          title="Change platform"
          className={cn(
            'inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-border bg-card pl-1.5 pr-1.5 transition-colors hover:border-border-strong',
            showLabel && 'pl-2.5 pr-2'
          )}
        >
          <PlatformLogo platform={api.platform} size={18} />
          {showLabel && <span className="ml-1 text-[13px]">{api.platformLabel}</span>}
          <ChevronDown size={12} aria-hidden className="text-faint" />
        </button>
      )}
    >
      {PLATFORM_OPTIONS.map((p) => (
        <MenuRadioItem key={p.value} checked={p.value === api.platform} onSelect={() => api.choosePlatform(p.value)} icon={<PlatformLogo platform={p.value} size={18} />}>
          {p.label}
        </MenuRadioItem>
      ))}
    </DropdownMenu>
  );
}

function LookupField({ api, inputRef, className }: { api: DraftApi; inputRef: RefObject<HTMLInputElement | null>; className?: string }) {
  const loading = api.lookup.state === 'loading';
  return (
    <div className={cn('relative flex min-w-0 flex-1 items-center', className)}>
      <Search size={14} aria-hidden className="pointer-events-none absolute left-3 text-faint" />
      <input
        ref={inputRef}
        value={api.query}
        onChange={(e) => {
          api.setQuery(e.target.value);
          api.setConfirmDiscard(false);
          if (!loading) api.setLookup({ state: 'idle' });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            api.doLookup();
          }
        }}
        placeholder={PLACEHOLDERS[api.platform] ?? 'Problem URL'}
        aria-label={`${api.platformLabel} problem number, code or URL`}
        className="field h-9 rounded-full pl-9 pr-10 font-mono text-[13px]"
      />
      <span className="absolute right-1.5 flex items-center">
        {loading ? (
          <span role="status" aria-label="Looking up" className="inline-grid size-7 place-items-center text-muted-foreground">
            <Loader2 size={14} className="animate-spin" aria-hidden />
          </span>
        ) : api.query.trim() ? (
          <button type="button" onClick={api.doLookup} data-new-row-submit aria-label="Look up problem" title="Look up (Enter)" className="btn btn-primary btn-sm btn-icon">
            <CornerDownLeft size={13} aria-hidden />
          </button>
        ) : null}
      </span>
    </div>
  );
}

function LookupMessage({ api }: { api: DraftApi }) {
  const { state, message } = api.lookup;
  if (state === 'not_found' || state === 'error') {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
        <span className={state === 'error' ? 'text-error' : 'text-muted-foreground'}>
          {state === 'error' ? message : `Couldn't find “${api.query.trim()}” on ${api.platformLabel}.`}
        </span>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => api.startDraft(null)}>
          Enter details manually
        </button>
        {state === 'error' && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={api.doLookup}>
            Retry
          </button>
        )}
      </div>
    );
  }
  if (state === 'idle') {
    return (
      <div className="flex flex-wrap items-center gap-3 text-[12px] text-faint">
        <KeyHints items={[['Enter', 'look up'], ['Esc', 'cancel']]} />
        <button type="button" className="link-underline border-faint/50 text-[12px] font-normal text-muted-foreground" onClick={() => api.startDraft(null)}>
          Add without lookup
        </button>
      </div>
    );
  }
  return null;
}

function DraftStatus({ api }: { api: DraftApi }) {
  return (
    <div className="flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
      {api.duplicate && (
        <span role="alert" className="inline-flex items-center gap-1.5 text-warning">
          Already tracked{api.duplicate.title ? ` as “${api.duplicate.title}”` : ''}.
          <button type="button" className="font-medium underline underline-offset-2" onClick={() => api.jumpTo(api.duplicate!.id)}>
            Jump to row
          </button>
        </span>
      )}
      {api.error && (
        <span role="alert" className="text-error">
          {api.error}
        </span>
      )}
      {api.confirmDiscard && <DiscardPrompt api={api} />}
    </div>
  );
}

function DiscardPrompt({ api }: { api: DraftApi }) {
  return (
    <span role="alert" className="inline-flex items-center gap-2 text-muted-foreground">
      Discard this draft?
      <button type="button" className="font-medium text-error underline underline-offset-2" onClick={api.onCancel}>
        Discard
      </button>
      <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={() => api.setConfirmDiscard(false)}>
        Keep editing
      </button>
    </span>
  );
}

function SaveButtons({ api }: { api: DraftApi }) {
  const d = api.draft!;
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn btn-ghost btn-sm" onClick={d.manual ? api.backToLookup : api.onCancel}>
        {d.manual ? 'Back' : 'Cancel'}
      </button>
      <button type="button" className="btn btn-primary btn-sm" onClick={api.save} disabled={api.saving}>
        {api.saving && <Loader2 size={13} className="animate-spin" aria-hidden />}
        {api.saving ? 'Saving…' : 'Save problem'}
      </button>
    </div>
  );
}

function Labeled({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="label mb-1.5 text-[10px]">
          {label}
        </label>
      ) : (
        <span className="label mb-1.5 text-[10px]">{label}</span>
      )}
      {children}
    </div>
  );
}

// ───────── Desktop: table rows ─────────

export function NewRow(props: NewRowProps) {
  const queryRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const api = useProblemDraft(props, { queryRef, titleRef });
  const { columns } = props;
  const { draft } = api;
  const uid = useId();
  const colSpan = 10 + columns.length;
  const rowBase = 'border-l-2 border-l-ember bg-ember-soft/40 [&>td]:align-middle';

  return (
    <>
      <tr data-new-row="true" aria-label="New problem" className={cn(rowBase, 'h-14 !border-b-0 hover:!bg-ember-soft/40')}>
        <td className="w-10 px-2 text-center">
          <span aria-hidden className="ember-dot ember-dot-pulse" />
        </td>
        <td className="w-11 px-1">
          <PlatformPicker api={api} />
        </td>
        <td className="px-3">
          {!draft ? (
            <div className="flex items-center gap-2">
              <LookupField api={api} inputRef={queryRef} />
              <button type="button" onClick={api.onCancel} data-new-row-cancel aria-label="Cancel adding a problem" title="Cancel (Esc)" className="btn btn-ghost btn-icon btn-sm shrink-0">
                <X size={14} aria-hidden />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {api.identLabel && <span className="shrink-0 font-mono text-xs text-muted-foreground">{api.identLabel}</span>}
              <input
                ref={titleRef}
                className={cn('field h-9 min-w-0 flex-1 font-medium', api.error && !draft.title.trim() && 'border-error')}
                value={draft.title}
                onChange={(e) => api.patch({ title: e.target.value })}
                onKeyDown={api.enterSaves}
                placeholder="Problem title"
                aria-label="Title"
                aria-invalid={!!api.error && !draft.title.trim()}
                maxLength={300}
              />
            </div>
          )}
        </td>
        <td className="px-3">{draft && <DifficultyPickerCell difficulty={draft.difficulty} onSave={(d) => api.patch({ difficulty: d })} />}</td>
        <td className="px-3">{draft && <TopicPickerCell topic={draft.topic} onSave={(t) => api.patch({ topic: t })} />}</td>
        <td className="px-3 font-mono text-xs text-faint">{draft ? 'New' : ''}</td>
        <td />
        <td className="px-3 font-mono text-xs text-faint">{draft ? 'after save' : ''}</td>
        <td className="px-2" data-draft-cell>
          {draft && <InlineTextCell value={draft.notes} label="Notes" placeholder="Add notes…" onSave={(v) => api.patch({ notes: v })} />}
        </td>
        {columns.map((col) => (
          <td key={col.id} className="px-2" data-draft-cell>
            {draft && (
              <CustomCell
                column={col}
                value={draft.customFields[col.name] ?? ''}
                onSave={(v) => api.patch({ customFields: { ...draft.customFields, [col.name]: v } })}
              />
            )}
          </td>
        ))}
        <td />
      </tr>
      <tr data-new-row="true" className={cn(rowBase, 'hover:!bg-ember-soft/40')}>
        <td colSpan={colSpan} className="px-0 pb-4 pt-0">
          <div className="sticky left-0 w-[calc(100vw-21rem)] max-w-[1100px] pl-[96px] pr-4">
            {!draft ? (
              <div className="flex flex-col gap-2 pb-0.5">
                <LookupMessage api={api} />
                {api.confirmDiscard && <DiscardPrompt api={api} />}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-end gap-3">
                  <Labeled label="URL" htmlFor={`${uid}-url`} className="w-[300px] max-w-full">
                    <input
                      id={`${uid}-url`}
                      className={cn('field h-9 font-mono text-[12.5px]', draft.url.trim() && !isHttpUrl(draft.url) && 'border-error')}
                      type="url"
                      inputMode="url"
                      value={draft.url}
                      onChange={(e) => api.patch({ url: e.target.value })}
                      onKeyDown={api.enterSaves}
                      placeholder={`${api.platformLabel} problem URL`}
                      aria-invalid={!!draft.url.trim() && !isHttpUrl(draft.url)}
                    />
                  </Labeled>
                  <Labeled label="Solved on" htmlFor={`${uid}-solved`}>
                    <input
                      id={`${uid}-solved`}
                      className="field h-9 w-[150px] font-mono text-[13px]"
                      type="date"
                      value={draft.solvedOn}
                      max={toLocalDateInput()}
                      onChange={(e) => api.patch({ solvedOn: e.target.value })}
                      onKeyDown={api.enterSaves}
                    />
                  </Labeled>
                  <Labeled label="Tags" className="min-w-[220px] flex-1">
                    <TagEditor tags={draft.tags} onChange={(t) => api.patch({ tags: t })} onSubmit={api.save} placeholder="e.g. Blind 75" />
                  </Labeled>
                  <SaveButtons api={api} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <KeyHints items={[['Enter', 'save'], ['Esc', 'cancel']]} />
                  {draft.manual && <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">Manual entry</span>}
                  <DraftStatus api={api} />
                </div>
              </div>
            )}
          </div>
        </td>
      </tr>
    </>
  );
}

// ───────── Phones: stacked card ─────────

export function NewProblemCard(props: NewRowProps) {
  const queryRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const api = useProblemDraft(props, { queryRef, titleRef });
  const { draft } = api;
  const uid = useId();
  const cached = useCachedProblems();
  const topics = mergeSuggestions(topicsFrom(cached), DEFAULT_TOPICS);

  return (
    <div data-new-row="true" className="flex flex-col gap-4 border-b border-border border-l-2 border-l-ember bg-ember-soft/40 px-4 py-4">
      <div className="flex items-center justify-between">
        <p className="eyebrow">New problem</p>
        <button type="button" onClick={api.onCancel} aria-label="Cancel adding a problem" className="btn btn-ghost btn-icon btn-sm -mr-1">
          <X size={15} aria-hidden />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <PlatformPicker api={api} />
        {!draft ? (
          <LookupField api={api} inputRef={queryRef} />
        ) : (
          <input
            ref={titleRef}
            className="field h-9 min-w-0 flex-1 font-medium"
            value={draft.title}
            onChange={(e) => api.patch({ title: e.target.value })}
            onKeyDown={api.enterSaves}
            placeholder="Problem title"
            aria-label="Title"
            maxLength={300}
          />
        )}
      </div>
      {!draft ? (
        <>
          <LookupMessage api={api} />
          {api.confirmDiscard && <DiscardPrompt api={api} />}
        </>
      ) : (
        <>
          <Labeled label="URL" htmlFor={`${uid}-url`}>
            <input
              id={`${uid}-url`}
              className="field font-mono text-[12.5px]"
              type="url"
              inputMode="url"
              value={draft.url}
              onChange={(e) => api.patch({ url: e.target.value })}
              onKeyDown={api.enterSaves}
              placeholder={`${api.platformLabel} problem URL`}
            />
          </Labeled>
          <Labeled label="Difficulty">
            <div role="radiogroup" aria-label="Difficulty" className="flex gap-1.5">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={draft.difficulty === d}
                  onClick={() => api.patch({ difficulty: d })}
                  className={cn('chip h-9 flex-1 justify-center text-[13px]', draft.difficulty === d ? `chip-${d.toLowerCase()}` : 'text-muted-foreground')}
                >
                  {cap(d)}
                </button>
              ))}
            </div>
          </Labeled>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Topic" htmlFor={`${uid}-topic`}>
              <input
                id={`${uid}-topic`}
                className="field"
                list={`${uid}-topics`}
                value={draft.topic}
                onChange={(e) => api.patch({ topic: e.target.value })}
                onKeyDown={api.enterSaves}
              />
              <datalist id={`${uid}-topics`}>
                {topics.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Labeled>
            <Labeled label="Solved on" htmlFor={`${uid}-solved`}>
              <input
                id={`${uid}-solved`}
                className="field font-mono text-[13px]"
                type="date"
                value={draft.solvedOn}
                max={toLocalDateInput()}
                onChange={(e) => api.patch({ solvedOn: e.target.value })}
              />
            </Labeled>
          </div>
          <Labeled label="Tags">
            <TagEditor tags={draft.tags} onChange={(t) => api.patch({ tags: t })} onSubmit={api.save} placeholder="e.g. Blind 75" />
          </Labeled>
          <Labeled label="Notes" htmlFor={`${uid}-notes`}>
            <textarea id={`${uid}-notes`} className="field" rows={3} value={draft.notes} onChange={(e) => api.patch({ notes: e.target.value })} />
          </Labeled>
          {props.columns.map((col) => (
            <Labeled key={col.id} label={col.name}>
              <div data-draft-cell className="rounded-md border border-border bg-card">
                <CustomCell
                  column={col}
                  value={draft.customFields[col.name] ?? ''}
                  onSave={(v) => api.patch({ customFields: { ...draft.customFields, [col.name]: v } })}
                />
              </div>
            </Labeled>
          ))}
          <DraftStatus api={api} />
          <div className="flex justify-end">
            <SaveButtons api={api} />
          </div>
        </>
      )}
    </div>
  );
}
