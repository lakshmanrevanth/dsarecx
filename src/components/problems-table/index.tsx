'use client';

// The problems ledger: a Notion-style tracker with click-to-create draft rows,
// click-to-edit cells (autosave), tabs, filters saved in the URL, lists, custom
// columns, bulk actions, soft delete with undo, and a card list on phones.

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import {
  Bookmark,
  ChevronRight,
  Columns3,
  Download,
  FileJson,
  FileSpreadsheet,
  ListMinus,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { siteConfig } from '@/config/site';
import { ImportModal } from '@/components/import-modal';
import { CustomCheckbox } from '@/components/ui/custom-checkbox';
import { DropdownMenu, MenuItem, MenuLabel, MenuSeparator, useMenuClose } from '@/components/ui/dropdown-menu';
import { TopicPill } from '@/components/ui/pill';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { COLUMN_TYPES, COLUMN_TYPE_LABELS, validateColumnName, toCustomColumn, type ColumnType } from '@/lib/custom-columns';
import { fetcher } from '@/lib/fetcher';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { COLUMN_TYPE_ICONS, ColumnSettings } from './column-settings';
import { ConfirmDialog } from './confirm-dialog';
import { AllCaughtUp, EmptyView, FirstRunPanel, NoMatches } from './empty-states';
import {
  clearFilters,
  filterProblems,
  formatNextReview,
  hasActiveFilters,
  isDueToday,
  nextReviewAfterToday,
  sortProblems,
  topicOptions as buildTopicOptions,
  visibleLimitFor,
} from './filters';
import { AddToListMenu, ListsMenu, type ProblemListSummary } from './lists-menu';
import { MobileRow } from './mobile-row';
import { NewProblemCard, NewRow, type NewProblemPayload } from './new-row';
import { useProblemPatch, type ProblemPatch } from './problem-editor';
import { ProblemRow } from './row';
import { failure, plural, postJson, type Json } from './shared';
import { tagsFrom, topicsFrom } from './suggestions';
import { TabBar } from './tab-bar';
import { Toolbar } from './toolbar';
import { useTableUrlState } from './use-table-url-state';

// Rows rendered at a time; "Show more" adds a page. Chosen over virtualization because
// of grouped rows, inline popovers and variable-height cells.
const PAGE_SIZE = 100;
const UNDO_MS = 6000;

// Fixed column widths (the problem column takes the rest).
const COL = { select: 40, platform: 44, difficulty: 112, topic: 210, status: 128, star: 48, next: 132, notes: 200, custom: 160, add: 136 };
const FIXED_WIDTH = COL.select + COL.platform + COL.difficulty + COL.topic + COL.status + COL.star + COL.next + COL.notes + COL.add;

const STATUS_GROUPS = [
  { key: 'ACTIVE', title: 'Active' },
  { key: 'MASTERED', title: 'Mastered' },
  { key: 'RETIRED', title: 'Retired' },
];

type Toast = { id: number; msg: string; tone?: 'error'; action?: { label: string; run: () => void } };

// ───────── Header pieces ─────────

function ColumnHeaderMenu({ col, onEdit, onDelete }: { col: Json; onEdit: () => void; onDelete: (id: string) => void }) {
  const type = toCustomColumn({ order: 0, ...col }).type;
  const Icon = COLUMN_TYPE_ICONS[type];
  return (
    <div className="group/col flex items-center justify-between gap-1">
      <span className="flex min-w-0 items-center gap-1.5">
        <Icon size={12} aria-hidden className="shrink-0 text-faint" />
        <span className="truncate">{col.name}</span>
      </span>
      <DropdownMenu
        label={`${col.name} column`}
        align="end"
        width={190}
        trigger={(p, { open }) => (
          <button
            {...p}
            aria-label={`Column options for ${col.name}`}
            className={cn(
              'inline-grid size-6 shrink-0 place-items-center rounded-full text-faint transition-opacity hover:bg-muted hover:text-foreground',
              open ? 'opacity-100' : 'pointer-fine:opacity-0 pointer-fine:group-hover/col:opacity-100 focus-visible:opacity-100'
            )}
          >
            <MoreHorizontal size={14} aria-hidden />
          </button>
        )}
      >
        <MenuLabel>{COLUMN_TYPE_LABELS[type]} column</MenuLabel>
        <MenuItem icon={<Pencil />} onSelect={onEdit}>
          Rename, type, order…
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Trash2 />} danger onSelect={() => onDelete(col.id)}>
          Delete column
        </MenuItem>
      </DropdownMenu>
    </div>
  );
}

function AddColumnForm({ existing, onSave }: { existing: Json[]; onSave: (name: string, type: ColumnType) => Promise<void> }) {
  const close = useMenuClose();
  const [name, setName] = useState('');
  const [type, setType] = useState<ColumnType>('text');
  const [error, setError] = useState('');
  return (
    <form
      className="flex flex-col gap-3 p-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const v = validateColumnName(name, existing.map((c) => toCustomColumn({ order: 0, ...c })));
        if (!v.ok) {
          setError(v.error);
          return;
        }
        close();
        await onSave(v.value, type);
      }}
    >
      <p className="eyebrow eyebrow-plain text-[10px]">New column</p>
      <div className="flex flex-col">
        <label htmlFor="add-col-name" className="label text-[10px]">
          Name
        </label>
        <input
          id="add-col-name"
          data-autofocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          placeholder="e.g. Company"
          maxLength={40}
          className={cn('field h-9', error && 'border-error')}
        />
        {error && (
          <span role="alert" className="mt-1 text-xs text-error">
            {error}
          </span>
        )}
      </div>
      <fieldset className="flex flex-col">
        <legend className="label text-[10px]">Type</legend>
        <div className="grid grid-cols-3 gap-1">
          {COLUMN_TYPES.map((t) => {
            const Icon = COLUMN_TYPE_ICONS[t];
            const on = t === type;
            return (
              <label
                key={t}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11.5px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                  on ? 'border-ember/50 bg-ember-soft text-ember-strong' : 'border-border text-muted-foreground hover:border-border-strong'
                )}
              >
                <input type="radio" name="add-col-type" value={t} checked={on} onChange={() => setType(t)} className="sr-only" />
                <Icon size={14} aria-hidden />
                {COLUMN_TYPE_LABELS[t]}
              </label>
            );
          })}
        </div>
        {type === 'select' && <span className="mt-1.5 text-[11.5px] text-faint">Add options in column settings after creating it.</span>}
      </fieldset>
      <button type="submit" disabled={!name.trim()} className="btn btn-primary btn-sm">
        <Plus size={14} aria-hidden /> Add column
      </button>
    </form>
  );
}

function SkeletonRow({ columns }: { columns: number }) {
  return (
    <tr className="h-12">
      <td className="px-2">
        <Skeleton className="mx-auto size-4 rounded" />
      </td>
      <td className="px-1">
        <Skeleton className="mx-auto size-5 rounded-md" />
      </td>
      <td className="px-3">
        <Skeleton className="h-3.5 w-52" />
      </td>
      <td className="px-3">
        <Skeleton className="h-5 w-16 rounded-full" />
      </td>
      <td className="px-3">
        <Skeleton className="h-5 w-24 rounded-full" />
      </td>
      <td className="px-3">
        <Skeleton className="h-3 w-20" />
      </td>
      <td />
      <td className="px-3">
        <Skeleton className="h-3 w-16" />
      </td>
      <td className="px-3">
        <Skeleton className="h-3 w-28" />
      </td>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-3">
          <Skeleton className="h-3 w-20" />
        </td>
      ))}
      <td />
    </tr>
  );
}

function GroupHeader({ title, count, topic, open, onToggle, asRow }: { title: string; count: number; topic?: boolean; open: boolean; onToggle: () => void; asRow: boolean }) {
  const button = (
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex h-10 items-center gap-2.5 px-3 text-left">
      <ChevronRight size={14} aria-hidden className={cn('text-faint transition-transform duration-150', open && 'rotate-90')} />
      {topic ? <TopicPill topic={title} /> : <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">{title}</span>}
      <span className="font-mono text-[11px] tabular-nums text-faint">{count}</span>
    </button>
  );
  if (!asRow) return <li className="border-b border-border bg-background-deep/50">{button}</li>;
  return (
    <tr className="bg-background-deep/50 hover:!bg-background-deep/50">
      <td colSpan={100} className="p-0">
        <div className="sticky left-0 w-max">{button}</div>
      </td>
    </tr>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function HeaderButton({ label, onClick, children, ...rest }: { label: string; onClick?: () => void; children: ReactNode } & ComponentPropsWithoutRef<"button">) {
  return (
    <Tooltip content={label}>
      <button type="button" onClick={onClick} aria-label={label} className="btn btn-outline btn-icon" {...rest}>
        {children}
      </button>
    </Tooltip>
  );
}

// ───────── Table ─────────

export function ProblemsTable() {
  const { data: allProblems, isLoading, error: loadError, mutate } = useSWR<Json[]>('/api/problems', fetcher);
  const { data: rawLists, mutate: mutateLists } = useSWR<ProblemListSummary[]>('/api/lists', fetcher);
  const { data: rawColumns, mutate: mutateColumns } = useSWR('/api/columns', fetcher);
  const { mutate: globalMutate } = useSWRConfig();
  const rawColumnsList: Json[] = useMemo(() => (Array.isArray(rawColumns) ? rawColumns : []), [rawColumns]);
  const lists: ProblemListSummary[] = useMemo(() => (Array.isArray(rawLists) ? rawLists : []), [rawLists]);

  const [mounted, setMounted] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const columns: Json[] = mounted ? rawColumnsList : [];
  const [state, update] = useTableUrlState();
  const [showNewRow, setShowNewRow] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [pendingColumnDelete, setPendingColumnDelete] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const pendingDelete = useRef<{ ids: string[]; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const tableRef = useRef<HTMLDivElement>(null);

  // Clear selection and paging when the visible rows change, so bulk actions never hit hidden rows.
  const viewKey = JSON.stringify([state.view, state.q, state.platforms, state.difficulties, state.statuses, state.topics, state.lists, state.due, state.group]);
  const [prevViewKey, setPrevViewKey] = useState(viewKey);
  if (prevViewKey !== viewKey) {
    setPrevViewKey(viewKey);
    setSelectedIds([]);
    setPageCount(1);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- avoid an SWR cache / media query hydration mismatch
  useEffect(() => setMounted(true), []);
  const showSkeleton = !mounted || (isLoading && !allProblems);

  const showToast = useCallback((msg: string, opts: { action?: Toast['action']; tone?: Toast['tone']; ms?: number } = {}) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), msg, action: opts.action, tone: opts.tone });
    toastTimer.current = setTimeout(() => setToast(null), opts.ms ?? 3500);
  }, []);
  const showError = useCallback((msg: string) => showToast(msg, { tone: 'error', ms: 5000 }), [showToast]);

  // ---- Derived rows ----
  const now = new Date();
  const listMembers = useMemo(() => new Map(lists.map((l) => [l.id, new Set(l.problemIds)])), [lists]);
  const base = useMemo(() => {
    const arr = Array.isArray(allProblems) ? allProblems : [];
    if (!pendingDeleteIds.length) return arr;
    const hidden = new Set(pendingDeleteIds);
    return arr.filter((p) => !hidden.has(p.id));
  }, [allProblems, pendingDeleteIds]);
  const topicOpts = useMemo(() => buildTopicOptions(base), [base]);
  const topicSuggestions = useMemo(() => topicsFrom(base), [base]);
  const tagSuggestions = useMemo(() => tagsFrom(base), [base]);
  const activeListId = state.view.startsWith('list:') ? state.view.slice(5) : null;
  const activeList = activeListId ? lists.find((l) => l.id === activeListId) : undefined;
  // A list tab whose list no longer exists shows All.
  const view = activeListId && Array.isArray(rawLists) && !activeList ? 'all' : state.view;
  const viewState = view === state.view ? state : { ...state, view };
  const filtered = filterProblems(base, viewState, { now, listMembers });
  const sorted = sortProblems(filtered, state.sort, state.order);
  const limit = visibleLimitFor(sorted.map((p) => p.id), pageCount * PAGE_SIZE, highlightId);
  const shown = sorted.length > limit ? sorted.slice(0, limit) : sorted;
  const dueCount = base.filter((p) => isDueToday(p, now)).length;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allShownSelected = shown.length > 0 && shown.every((p) => selectedSet.has(p.id));
  const someShownSelected = !allShownSelected && shown.some((p) => selectedSet.has(p.id));

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);
  const toggleSelectAll = () => setSelectedIds(allShownSelected ? [] : shown.map((p) => p.id));

  // ---- Highlight + scroll to a row ----
  useEffect(() => {
    if (!highlightId) return;
    const t1 = setTimeout(() => document.getElementById(`problem-row-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    const t2 = setTimeout(() => setHighlightId(null), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [highlightId]);

  const jumpToProblem = useCallback(
    (id: string) => {
      const p = base.find((x) => x.id === id);
      if (!p) return;
      if (filterProblems([p], state, { now: new Date(), listMembers }).length === 0) update((s) => ({ ...clearFilters(s), view: 'all' }));
      setShowNewRow(false);
      setHighlightId(id);
    },
    [base, state, listMembers, update]
  );

  // ---- Delete with soft undo: the DELETE is sent only after the toast expires ----
  const commitDelete = useCallback(
    async (ids: string[], keepalive = false) => {
      try {
        await postJson('/api/problems/bulk', { ids, action: 'delete' }, keepalive ? { keepalive: true } : undefined);
        const gone = new Set(ids);
        mutate((prev: Json[] | undefined) => prev?.filter((p) => !gone.has(p.id)) ?? [], { revalidate: false });
        mutateLists();
      } catch (caught) {
        const e = failure(caught);
        mutate();
        showError(e?.message ?? 'Failed to delete problems');
      } finally {
        const gone = new Set(ids);
        setPendingDeleteIds((prev) => prev.filter((id) => !gone.has(id)));
      }
    },
    [mutate, mutateLists, showError]
  );

  const flushPendingDelete = useCallback(
    (keepalive = false) => {
      const pending = pendingDelete.current;
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingDelete.current = null;
      commitDelete(pending.ids, keepalive);
    },
    [commitDelete]
  );

  const startDelete = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      flushPendingDelete();
      setShowDeleteModal(false);
      setSelectedIds([]);
      setPendingDeleteIds((prev) => [...prev, ...ids]);
      const timer = setTimeout(() => {
        pendingDelete.current = null;
        commitDelete(ids);
      }, UNDO_MS);
      pendingDelete.current = { ids, timer };
      showToast(`Deleted ${plural(ids.length, 'problem')}`, {
        ms: UNDO_MS,
        action: {
          label: 'Undo',
          run: () => {
            if (pendingDelete.current?.ids !== ids) return;
            clearTimeout(pendingDelete.current.timer);
            pendingDelete.current = null;
            const restore = new Set(ids);
            setPendingDeleteIds((prev) => prev.filter((id) => !restore.has(id)));
            showToast(`Restored ${plural(ids.length, 'problem')}`);
          },
        },
      });
    },
    [commitDelete, flushPendingDelete, showToast]
  );
  const deleteOne = useCallback((id: string) => startDelete([id]), [startDelete]);

  // Leaving the page commits a pending delete.
  const flushRef = useRef(flushPendingDelete);
  useEffect(() => {
    flushRef.current = flushPendingDelete;
  }, [flushPendingDelete]);
  useEffect(() => {
    const onHide = () => flushRef.current(true);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      flushRef.current(true);
    };
  }, []);

  // One row: undo is enough. Several: confirm first.
  const handleDeleteClick = useCallback(() => {
    if (!selectedIds.length) return;
    if (selectedIds.length === 1) startDelete([...selectedIds]);
    else setShowDeleteModal(true);
  }, [selectedIds, startDelete]);

  const openNewRow = useCallback(() => {
    setShowNewRow(true);
    requestAnimationFrame(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }, []);

  // Keyboard: Delete/Backspace removes the selection, Esc clears it, N adds a problem.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
      if (typing || showDeleteModal || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[data-popover], [data-problem-editor], [aria-modal="true"]')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length) {
        e.preventDefault();
        handleDeleteClick();
      } else if (e.key === 'Escape' && selectedIds.length && !showNewRow) {
        setSelectedIds([]);
      } else if ((e.key === 'n' || e.key === 'N') && !showNewRow) {
        e.preventDefault();
        openNewRow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds.length, showDeleteModal, showNewRow, handleDeleteClick, openNewRow]);

  // ---- Single-row edits (optimistic) ----
  const patchProblem = useCallback(
    async (id: string, patch: Record<string, unknown>, errorMsg: string, rethrow = true) => {
      mutate((prev: Json[] | undefined) => prev?.map((p) => (p.id === id ? { ...p, ...patch } : p)) ?? [], { revalidate: false });
      try {
        const res = await fetch(`/api/problems/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error ?? errorMsg);
        }
        const json = await res.json().catch(() => null);
        if (json?.problem) mutate((prev: Json[] | undefined) => prev?.map((p) => (p.id === id ? { ...p, ...json.problem } : p)) ?? [], { revalidate: false });
      } catch (caught) {
        const e = failure(caught);
        mutate();
        showError(e?.message ?? errorMsg);
        if (rethrow) throw e;
      }
    },
    [mutate, showError]
  );

  const problemPatch = useProblemPatch();
  const handleProblemUpdate = useCallback(
    async (id: string, patch: ProblemPatch) => {
      await problemPatch(id, patch);
      globalMutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/stats'));
    },
    [problemPatch, globalMutate]
  );
  const handleStarToggle = useCallback((id: string, current: boolean) => {
    patchProblem(id, { isFavorite: !current }, 'Failed to update bookmark', false);
  }, [patchProblem]);
  const handleNotesSave = useCallback((id: string, notes: string) => patchProblem(id, { notes }, 'Failed to save notes'), [patchProblem]);
  const handleDifficultySave = useCallback((id: string, difficulty: string) => patchProblem(id, { difficulty }, 'Failed to update difficulty'), [patchProblem]);
  const handleTopicSave = useCallback((id: string, topic: string) => patchProblem(id, { topic }, 'Failed to update topic', false), [patchProblem]);
  const handleTagsSave = useCallback((id: string, tags: string[]) => patchProblem(id, { tags }, 'Failed to save tags', false), [patchProblem]);

  const handleCustomFieldSave = useCallback(
    async (id: string, columnName: string, value: string) => {
      mutate(
        (prev: Json[] | undefined) =>
          prev?.map((p) => (p.id !== id ? p : { ...p, customFields: { ...((p.customFields as Record<string, string>) ?? {}), [columnName]: value } })) ?? [],
        { revalidate: false }
      );
      try {
        const res = await fetch(`/api/problems/${id}/custom-fields`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: columnName, value }),
        });
        if (!res.ok) throw new Error('Failed to save field');
      } catch (caught) {
        const e = failure(caught);
        mutate();
        showError(e?.message ?? 'Failed to save field');
        throw e;
      }
    },
    [mutate, showError]
  );

  const handleNewProblemSave = useCallback(
    async (data: NewProblemPayload) => {
      const payload = { ...data, dateSolved: data.dateSolved ?? new Date().toISOString() };
      const res = await fetch('/api/problems', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The draft reads status/existingId to offer "Already tracked · jump to row".
        const err = new Error(json.error ?? 'Failed to create problem') as Error & { status?: number; existingId?: string };
        err.status = res.status;
        err.existingId = json.existingId;
        throw err;
      }
      mutate((prev: Json[] | undefined) => [json, ...(prev?.filter((p) => p.id !== json.id) ?? [])], { revalidate: false });
      globalMutate((key: unknown) => typeof key === 'string' && (key.startsWith('/api/daily') || key.startsWith('/api/stats')));
      setShowNewRow(false);
      if (!json?.id) return;
      if (filterProblems([json], state, { now: new Date(), listMembers }).length > 0) {
        setHighlightId(json.id);
        showToast(`Added “${json.title}”`);
      } else {
        showToast(`Added “${json.title}”. It's hidden by the current view.`, {
          ms: UNDO_MS,
          action: {
            label: 'Show',
            run: () => {
              update((s) => ({ ...clearFilters(s), view: 'all' }));
              setHighlightId(json.id);
              setToast(null);
            },
          },
        });
      }
    },
    [mutate, globalMutate, state, listMembers, showToast, update]
  );

  // ---- Custom columns ----
  const handleAddColumn = useCallback(
    async (name: string, type: ColumnType) => {
      const order = rawColumnsList.length;
      const tempId = `temp-${Date.now()}`;
      mutateColumns((prev: Json[] | undefined) => [...(prev ?? []), { id: tempId, name, type, options: [], order }], { revalidate: false });
      try {
        const res = await fetch('/api/columns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type, order }) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? 'Failed to create column');
        mutateColumns((prev: Json[] | undefined) => prev?.map((c) => (c.id === tempId ? json : c)) ?? [], { revalidate: false });
        showToast(`Added column “${name}”`, type === 'select' ? { action: { label: 'Add options', run: () => setShowColumnSettings(true) } } : {});
      } catch (caught) {
        const e = failure(caught);
        mutateColumns();
        showError(e?.message ?? 'Failed to create column');
      }
    },
    [rawColumnsList.length, mutateColumns, showToast, showError]
  );

  // Deleting a column also deletes its values in every problem, so confirm first.
  const requestDeleteColumn = useCallback(
    (id: string) => {
      const col = rawColumnsList.find((c: Json) => c.id === id);
      setPendingColumnDelete({ id, name: col?.name ?? 'this column' });
    },
    [rawColumnsList]
  );
  const confirmDeleteColumn = useCallback(
    async (id: string) => {
      setPendingColumnDelete(null);
      mutateColumns((prev: Json[] | undefined) => prev?.filter((c) => c.id !== id) ?? [], { revalidate: false });
      try {
        const res = await fetch(`/api/columns/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete column');
        mutate();
      } catch {
        mutateColumns();
        showError('Failed to delete column');
      }
    },
    [mutateColumns, mutate, showError]
  );

  // ---- Bulk actions (one request each) ----
  const handleBulkStatus = useCallback(
    async (status: string) => {
      const ids = [...selectedIds];
      const set = new Set(ids);
      mutate((prev: Json[] | undefined) => prev?.map((p) => (set.has(p.id) ? { ...p, status } : p)) ?? [], { revalidate: false });
      setSelectedIds([]);
      try {
        const { count } = await postJson('/api/problems/bulk', { ids, action: 'status', value: status });
        showToast(`Marked ${plural(count, 'problem')} ${status.toLowerCase()}`);
      } catch (caught) {
        const e = failure(caught);
        showError(e?.message ?? 'Failed to update status');
      }
      mutate(); // pick up the review dates the server set for the new status
      globalMutate((key: unknown) => typeof key === 'string' && (key.startsWith('/api/daily') || key.startsWith('/api/stats')));
    },
    [selectedIds, mutate, globalMutate, showToast, showError]
  );

  const selectedAllFavorite = selectedIds.length > 0 && selectedIds.every((id) => base.find((p) => p.id === id)?.isFavorite);
  const handleBulkFavorite = useCallback(async () => {
    const ids = [...selectedIds];
    const value = !selectedAllFavorite;
    const set = new Set(ids);
    mutate((prev: Json[] | undefined) => prev?.map((p) => (set.has(p.id) ? { ...p, isFavorite: value } : p)) ?? [], { revalidate: false });
    try {
      await postJson('/api/problems/bulk', { ids, action: 'favorite', value });
      showToast(`${value ? 'Bookmarked' : 'Removed bookmark from'} ${plural(ids.length, 'problem')}`);
    } catch (caught) {
      const e = failure(caught);
      mutate();
      showError(e?.message ?? 'Failed to update bookmarks');
    }
  }, [selectedIds, selectedAllFavorite, mutate, showToast, showError]);

  // ---- Lists ----
  const createList = useCallback(
    async (name: string) => {
      const list = await postJson('/api/lists', { name });
      mutateLists((prev) => [...(prev ?? []), list], { revalidate: false });
      return list as ProblemListSummary;
    },
    [mutateLists]
  );

  const renameList = useCallback(
    async (id: string, name: string) => {
      const res = await fetch(`/api/lists/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? 'Rename failed');
      mutateLists((prev) => prev?.map((l) => (l.id === id ? { ...l, name } : l)), { revalidate: false });
    },
    [mutateLists]
  );

  const deleteList = useCallback(
    async (id: string) => {
      const name = lists.find((l) => l.id === id)?.name ?? 'list';
      mutateLists((prev) => prev?.filter((l) => l.id !== id), { revalidate: false });
      update((s) => ({ ...s, view: s.view === `list:${id}` ? 'all' : s.view, lists: s.lists.filter((x) => x !== id) }));
      try {
        const res = await fetch(`/api/lists/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete list');
        showToast(`Deleted list “${name}”`);
      } catch (caught) {
        const e = failure(caught);
        mutateLists();
        showError(e?.message ?? 'Failed to delete list');
      }
    },
    [lists, mutateLists, update, showToast, showError]
  );

  const changeListMembers = useCallback(
    async (listId: string, ids: string[], action: 'add' | 'remove', listName?: string) => {
      try {
        const res = await postJson(`/api/lists/${listId}/problems`, { problemIds: ids, action });
        mutateLists((prev) => prev?.map((l) => (l.id === listId ? { ...l, count: res.count, problemIds: res.problemIds } : l)), { revalidate: false });
        const name = listName ?? lists.find((l) => l.id === listId)?.name ?? 'list';
        showToast(`${action === 'add' ? 'Added' : 'Removed'} ${plural(res.changed, 'problem')} ${action === 'add' ? 'to' : 'from'} “${name}”`);
        if (action === 'remove') setSelectedIds([]);
      } catch (caught) {
        const e = failure(caught);
        showError(e?.message ?? 'Failed to update list');
      }
    },
    [lists, mutateLists, showToast, showError]
  );

  const createAndAdd = useCallback(
    async (name: string) => {
      const list = await createList(name);
      await changeListMembers(list.id, [...selectedIds], 'add', list.name);
    },
    [createList, changeListMembers, selectedIds]
  );

  // ---- Import / export ----
  const handleImportComplete = useCallback(
    (result: { imported: number; skipped: number; total: number; updated?: number; customColumnsCreated?: string[] }) => {
      mutate();
      mutateColumns();
      mutateLists();
      globalMutate((key: unknown) => typeof key === 'string' && (key.startsWith('/api/problems') || key.startsWith('/api/daily') || key.startsWith('/api/stats') || key === '/api/columns'));
      const cols = result.customColumnsCreated?.length ? ` · ${plural(result.customColumnsCreated.length, 'new column')}` : '';
      const upd = result.updated ? ` · ${result.updated} updated` : '';
      showToast(`Imported ${plural(result.imported, 'problem')}${upd}${cols}${result.skipped ? ` · ${result.skipped} skipped` : ''}`);
    },
    [mutate, mutateColumns, mutateLists, globalMutate, showToast]
  );

  const exportCsv = async () => {
    const ids = selectedIds.length ? [...selectedIds] : sorted.map((p: Json) => p.id);
    if (!ids.length) {
      showToast('No problems to export');
      return;
    }
    try {
      const res = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'csv', ids }) });
      if (!res.ok) throw new Error();
      downloadBlob(await res.blob(), `${siteConfig.logoWord}-problems-${new Date().toISOString().slice(0, 10)}.csv`);
      showToast(`Exported ${plural(ids.length, 'problem')} to CSV`);
    } catch {
      showError('Export failed');
    }
  };

  const exportBackup = async () => {
    try {
      const res = await fetch('/api/export?format=json');
      if (!res.ok) throw new Error();
      downloadBlob(await res.blob(), `${siteConfig.logoWord}-backup-${new Date().toISOString().slice(0, 10)}.json`);
      showToast('Backup downloaded. Restore it any time with Import.');
    } catch {
      showError('Backup failed');
    }
  };

  // First-run panel needs the user's ladder.
  const isFirstRun = !showSkeleton && Array.isArray(allProblems) && allProblems.length === 0;
  const { data: settings } = useSWR<Json>(isFirstRun ? '/api/settings' : null, fetcher);
  const ladder: number[] | undefined = settings?.preferences?.ladderDays;

  // ---- Rendering ----
  const renderEmpty = () => {
    if (loadError && !allProblems) {
      return (
        <EmptyView
          eyebrow="Couldn't load"
          heading={
            <>
              Something went <em>wrong.</em>
            </>
          }
          text="Your problems couldn't be loaded. Check your connection and reload the page."
        />
      );
    }
    if (isFirstRun) return showNewRow ? null : <FirstRunPanel onAdd={openNewRow} onImport={() => setShowImport(true)} ladder={ladder} />;
    if (hasActiveFilters(state)) return <NoMatches onClear={() => update(clearFilters)} />;
    if (view === 'due') {
      const next = nextReviewAfterToday(base, now);
      return <AllCaughtUp nextReview={next ? formatNextReview(next, now) : null} />;
    }
    if (view === 'bookmarked')
      return (
        <EmptyView
          eyebrow="Bookmarked · 0"
          heading={
            <>
              No bookmarks <em>yet.</em>
            </>
          }
          text="Bookmark a problem to keep it here."
        />
      );
    if (activeList)
      return (
        <EmptyView
          eyebrow={`${activeList.name} · 0`}
          heading={
            <>
              This list is <em>empty.</em>
            </>
          }
          text="Select problems in All problems, then choose “Add to list”."
        />
      );
    return <NoMatches onClear={() => update((s) => ({ ...clearFilters(s), view: 'all' }))} message="Nothing to show in this view." />;
  };

  const renderRow = (p: Json) =>
    isMobile ? (
      <MobileRow
        key={p.id}
        problem={p}
        isSelected={selectedSet.has(p.id)}
        selectionMode={selectedIds.length > 0}
        isHighlighted={highlightId === p.id}
        onToggleSelect={toggleSelect}
        onStarToggle={handleStarToggle}
        onProblemUpdate={handleProblemUpdate}
        onJumpToProblem={jumpToProblem}
        onDelete={deleteOne}
      />
    ) : (
      <ProblemRow
        key={p.id}
        problem={p}
        columns={columns}
        isSelected={selectedSet.has(p.id)}
        isHighlighted={highlightId === p.id}
        onToggleSelect={toggleSelect}
        onStarToggle={handleStarToggle}
        onDifficultySave={handleDifficultySave}
        onTopicSave={handleTopicSave}
        onNotesSave={handleNotesSave}
        onTagsSave={handleTagsSave}
        onCustomFieldSave={handleCustomFieldSave}
        onProblemUpdate={handleProblemUpdate}
        onJumpToProblem={jumpToProblem}
        onDelete={deleteOne}
        topicSuggestions={topicSuggestions}
        tagSuggestions={tagSuggestions}
      />
    );

  const renderGroups = () => {
    if (state.group === 'none') return shown.map(renderRow);
    const groups: { key: string; title: string; topic?: boolean; total: number; rows: Json[] }[] = [];
    if (state.group === 'status') {
      for (const g of STATUS_GROUPS) {
        const total = sorted.filter((p) => p.status === g.key).length;
        if (total) groups.push({ key: g.key, title: g.title, total, rows: shown.filter((p) => p.status === g.key) });
      }
    } else {
      const totals = new Map<string, number>();
      for (const p of sorted) totals.set(p.topic || 'General', (totals.get(p.topic || 'General') ?? 0) + 1);
      for (const [topic, total] of totals) {
        groups.push({ key: `t:${topic}`, title: topic, topic: true, total, rows: shown.filter((p) => (p.topic || 'General') === topic) });
      }
    }
    return groups.flatMap((g) => {
      const open = !collapsed[g.key];
      const header = (
        <GroupHeader
          key={`h-${g.key}`}
          title={g.title}
          count={g.total}
          topic={g.topic}
          open={open}
          asRow={!isMobile}
          onToggle={() => setCollapsed((c) => ({ ...c, [g.key]: open }))}
        />
      );
      return [header, ...(open ? g.rows.map(renderRow) : [])];
    });
  };

  const remaining = sorted.length - shown.length;
  const showMore = remaining > 0 && (
    <div className="flex items-center justify-center gap-3 border-t border-border px-4 py-4">
      <button type="button" onClick={() => setPageCount((c) => c + 1)} className="btn btn-outline btn-sm">
        Show {Math.min(PAGE_SIZE, remaining)} more
      </button>
      <span className="font-mono text-[11px] text-faint">{remaining.toLocaleString()} hidden</span>
    </div>
  );

  const newRowBar = (
    <button
      type="button"
      onClick={openNewRow}
      className="group/new flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-[13.5px] text-muted-foreground transition-colors hover:bg-ember-soft/50 hover:text-foreground"
    >
      <span className="inline-grid size-6 place-items-center rounded-full border border-dashed border-border-strong text-faint transition-colors group-hover/new:border-ember group-hover/new:text-ember">
        <Plus size={13} aria-hidden />
      </span>
      New problem
      <kbd className="kbd ml-auto hidden md:inline-grid">N</kbd>
    </button>
  );

  const draftProps = { onSave: handleNewProblemSave, onCancel: () => setShowNewRow(false), columns, onJumpToProblem: jumpToProblem };
  const empty = !showSkeleton && sorted.length === 0;
  const total = base.length;
  const viewLabel = view === 'due' ? 'Due today' : view === 'bookmarked' ? 'Bookmarked' : activeList ? activeList.name : 'All problems';
  const tableMinWidth = FIXED_WIDTH + 320 + columns.length * COL.custom;

  const thClass = 'h-10 px-3 font-medium whitespace-nowrap';

  return (
    <div className="flex flex-col">
      {/* Toasts: always mounted so screen readers announce changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          'pointer-events-none fixed inset-x-4 z-[100] flex justify-center md:inset-x-auto md:bottom-6 md:right-6 md:justify-end',
          selectedIds.length ? 'bottom-40 md:bottom-24' : 'bottom-24'
        )}
      >
        {toast && (
          <div
            key={toast.id}
            className={cn(
              'card pointer-events-auto flex max-w-[440px] items-center gap-4 rounded-full py-2.5 pl-5 pr-3 text-[13.5px] shadow-pop animate-in fade-in-0 slide-in-from-bottom-2 duration-200',
              toast.tone === 'error' && 'border-error-border'
            )}
          >
            {toast.tone === 'error' ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-error" /> : <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-ember" />}
            <span className={cn('min-w-0', toast.tone === 'error' && 'text-error')}>{toast.msg}</span>
            {toast.action ? (
              <button type="button" onClick={toast.action.run} className="btn btn-primary btn-sm shrink-0">
                {toast.action.label}
              </button>
            ) : (
              <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="inline-grid size-7 shrink-0 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground">
                <X size={13} aria-hidden />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Selection bar */}
      {selectedIds.length > 0 && (
        <div
          role="toolbar"
          aria-label={`${selectedIds.length} selected`}
          className="card fixed inset-x-3 bottom-24 z-[70] flex items-center gap-1 overflow-x-auto rounded-full py-1.5 pl-4 pr-1.5 shadow-pop animate-in fade-in-0 slide-in-from-bottom-3 duration-200 [scrollbar-width:none] md:inset-x-auto md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:pl-5"
        >
          <span className="mr-2 flex shrink-0 items-center gap-2 font-mono text-[12px] tabular-nums text-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-ember" />
            {selectedIds.length}
            <span className="hidden sm:inline">selected</span>
          </span>
          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
          <button type="button" onClick={() => handleBulkStatus('MASTERED')} className="btn btn-ghost btn-sm shrink-0 text-foreground">
            Mastered
          </button>
          <button type="button" onClick={() => handleBulkStatus('ACTIVE')} className="btn btn-ghost btn-sm shrink-0 text-foreground">
            Active
          </button>
          <button type="button" onClick={() => handleBulkStatus('RETIRED')} className="btn btn-ghost btn-sm shrink-0 text-foreground">
            Retired
          </button>
          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
          <button
            type="button"
            onClick={handleBulkFavorite}
            aria-label={selectedAllFavorite ? 'Remove bookmarks from selected' : 'Bookmark selected'}
            title={selectedAllFavorite ? 'Remove bookmarks' : 'Bookmark'}
            className={cn('btn btn-ghost btn-sm btn-icon shrink-0', selectedAllFavorite ? 'text-ember' : 'text-foreground')}
          >
            <Bookmark size={14} aria-hidden fill={selectedAllFavorite ? 'currentColor' : 'none'} />
          </button>
          <AddToListMenu lists={lists} compact={isMobile} onAdd={(id) => changeListMembers(id, [...selectedIds], 'add')} onCreateAndAdd={createAndAdd} />
          {activeList && (
            <button
              type="button"
              onClick={() => changeListMembers(activeList.id, [...selectedIds], 'remove')}
              aria-label={`Remove selected from ${activeList.name}`}
              title={`Remove from “${activeList.name}”`}
              className="btn btn-ghost btn-sm shrink-0 text-foreground"
            >
              <ListMinus size={14} aria-hidden />
              <span className="hidden md:inline">Remove</span>
            </button>
          )}
          <button type="button" onClick={exportCsv} aria-label="Export selected to CSV" title="Export to CSV" className="btn btn-ghost btn-sm btn-icon shrink-0 text-foreground">
            <Download size={14} aria-hidden />
          </button>
          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
          <button type="button" onClick={handleDeleteClick} aria-label={`Delete ${selectedIds.length} selected`} className="btn btn-sm shrink-0 border-error-border bg-error-bg text-error hover:border-error">
            <Trash2 size={14} aria-hidden />
            <span className="hidden md:inline">Delete</span>
          </button>
          <button type="button" onClick={() => setSelectedIds([])} aria-label="Clear selection" title="Clear selection (Esc)" className="btn btn-ghost btn-sm btn-icon shrink-0">
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      {/* Page header */}
      <header className="flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">
            (01) Problems
            {mounted && Array.isArray(allProblems) && (
              <span className="text-faint">
                {' '}
                · {total.toLocaleString()} tracked{dueCount ? ` · ${dueCount} due` : ''}
              </span>
            )}
          </p>
          <h1 className="display mt-4 text-5xl text-foreground md:text-6xl">
            Your <em>problems.</em>
          </h1>
          <p className="mt-3 max-w-[520px] text-[15px] leading-relaxed text-muted-foreground">
            Every problem you&apos;ve solved and when it comes back. Click any cell to edit it.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <HeaderButton label="Import CSV, Excel or a backup" onClick={() => setShowImport(true)} data-import-button>
            <Upload size={16} aria-hidden />
          </HeaderButton>
          <DropdownMenu
            label="Export"
            align="end"
            width={250}
            trigger={(p) => (
              <button {...p} aria-label="Export" title="Export" className="btn btn-outline btn-icon" data-download-button>
                <Download size={16} aria-hidden />
              </button>
            )}
          >
            <MenuLabel>Export</MenuLabel>
            <MenuItem icon={<FileSpreadsheet />} onSelect={exportCsv} hint={selectedIds.length ? `${selectedIds.length}` : `${sorted.length}`}>
              {selectedIds.length ? 'Selected as CSV' : 'This view as CSV'}
            </MenuItem>
            <MenuItem icon={<FileJson />} onSelect={exportBackup}>
              Full JSON backup
            </MenuItem>
            <p className="px-2.5 pb-1.5 pt-1 text-[11.5px] leading-snug text-faint">The backup keeps reviews, lists and columns, and restores with Import.</p>
          </DropdownMenu>
          <HeaderButton label="Custom columns" onClick={() => setShowColumnSettings(true)}>
            <Columns3 size={16} aria-hidden />
          </HeaderButton>
          <button type="button" id="new-problem-btn" data-new-problem-button onClick={openNewRow} className="btn btn-ember ml-1 flex-1 md:flex-none" title="New problem (N)">
            <Plus size={16} aria-hidden /> New problem
          </button>
        </div>
      </header>

      {/* Views + filters */}
      <div className="mt-8">
        <TabBar
          activeTab={view}
          onChange={(v) => update({ view: v })}
          lists={lists}
          dueCount={mounted ? dueCount : undefined}
          totalCount={mounted && total ? total : undefined}
          trailing={
            <ListsMenu
              lists={lists}
              onOpen={(id) => update({ view: `list:${id}` })}
              onCreate={async (name) => {
                const l = await createList(name);
                update({ view: `list:${l.id}` });
              }}
              onRename={renameList}
              onDelete={deleteList}
            />
          }
        />
      </div>
      <div className="mt-5">
        <Toolbar
          state={state}
          onChange={update}
          topicOptions={topicOpts}
          lists={lists}
          trailing={
            !showSkeleton && total > 0 ? (
              <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-faint lg:inline" aria-live="polite">
                {sorted.length === total ? plural(total, 'row') : `${sorted.length} of ${total}`}
              </span>
            ) : null
          }
        />
      </div>

      {/* Ledger */}
      <h2 className="sr-only">{viewLabel}</h2>
      {isMobile && mounted ? (
        <div ref={tableRef} data-mobile-list className="card mt-5 overflow-hidden">
          {showNewRow ? <NewProblemCard {...draftProps} /> : newRowBar}
          {!showSkeleton && shown.length > 0 && (
            <div className="flex items-center gap-2 border-b border-border bg-background-deep/40 px-2 py-1.5">
              <div className="grid size-10 place-items-center">
                <CustomCheckbox
                  checked={allShownSelected ? true : someShownSelected ? 'mixed' : false}
                  onChange={toggleSelectAll}
                  title={allShownSelected ? 'Deselect all' : 'Select all'}
                  size={18}
                />
              </div>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
                {plural(sorted.length, 'problem')} · long-press to select
              </span>
            </div>
          )}
          {showSkeleton ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2 border-b border-border px-4 py-4">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))
          ) : empty ? (
            renderEmpty()
          ) : (
            <ul aria-label={viewLabel}>{renderGroups()}</ul>
          )}
          {showMore}
        </div>
      ) : (
        <div ref={tableRef} data-table-container className="card mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            {!showNewRow && <div className="sticky left-0">{newRowBar}</div>}
            <table data-problems-table className="table-paper w-full table-fixed border-collapse" style={{ minWidth: tableMinWidth }}>
              <colgroup>
                <col style={{ width: COL.select }} />
                <col style={{ width: COL.platform }} />
                <col />
                <col style={{ width: COL.difficulty }} />
                <col style={{ width: COL.topic }} />
                <col style={{ width: COL.status }} />
                <col style={{ width: COL.star }} />
                <col style={{ width: COL.next }} />
                <col style={{ width: COL.notes }} />
                {columns.map((c) => (
                  <col key={c.id} style={{ width: COL.custom }} />
                ))}
                <col style={{ width: COL.add }} />
              </colgroup>
              <thead className="bg-background-deep/40">
                <tr>
                  <th className="h-10 px-2">
                    <div className="flex justify-center">
                      <CustomCheckbox
                        checked={allShownSelected ? true : someShownSelected ? 'mixed' : false}
                        onChange={toggleSelectAll}
                        title={allShownSelected ? 'Deselect all' : 'Select all'}
                        disabled={!shown.length}
                        className={cn(!selectedIds.length && 'opacity-50 hover:opacity-100')}
                      />
                    </div>
                  </th>
                  <th className="px-1">
                    <span className="sr-only">Platform</span>
                  </th>
                  <th className={thClass}>Problem</th>
                  <th className={thClass}>Difficulty</th>
                  <th className={thClass}>Topic · tags</th>
                  <th className={thClass}>Status</th>
                  <th className="px-1 text-center">
                    <span className="inline-flex justify-center text-faint" title="Bookmarked">
                      <Bookmark size={13} aria-hidden />
                      <span className="sr-only">Bookmarked</span>
                    </span>
                  </th>
                  <th className={thClass}>Next review</th>
                  <th className={thClass}>Notes</th>
                  {columns.map((col) => (
                    <th key={col.id} className={thClass}>
                      <ColumnHeaderMenu col={col} onEdit={() => setShowColumnSettings(true)} onDelete={requestDeleteColumn} />
                    </th>
                  ))}
                  <th className="px-2">
                    <DropdownMenu
                      label="Add a column"
                      role="dialog"
                      align="end"
                      width={260}
                      trigger={(p) => (
                        <button
                          {...p}
                          className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Plus size={12} aria-hidden /> Column
                        </button>
                      )}
                    >
                      <AddColumnForm existing={rawColumnsList} onSave={handleAddColumn} />
                    </DropdownMenu>
                  </th>
                </tr>
              </thead>
              <tbody>
                {showNewRow && <NewRow {...draftProps} />}
                {showSkeleton ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} columns={columns.length} />) : empty ? null : renderGroups()}
              </tbody>
            </table>
            {empty && <div className="sticky left-0">{renderEmpty()}</div>}
          </div>
          {showMore}
        </div>
      )}

      {showImport && <ImportModal open={showImport} onClose={() => setShowImport(false)} onImportComplete={handleImportComplete} />}

      <ColumnSettings
        open={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        onChanged={() => {
          mutateColumns();
          mutate();
        }}
      />

      {pendingColumnDelete && (
        <ConfirmDialog
          title={`Delete “${pendingColumnDelete.name}”?`}
          description="Its values are removed from every problem. This can't be undone."
          confirmLabel="Delete column"
          onConfirm={() => confirmDeleteColumn(pendingColumnDelete.id)}
          onCancel={() => setPendingColumnDelete(null)}
        />
      )}

      {showDeleteModal && (
        <ConfirmDialog
          title={`Delete ${plural(selectedIds.length, 'problem')}?`}
          description="This also deletes their review history. You can undo for a few seconds afterwards."
          confirmLabel={`Delete ${selectedIds.length}`}
          onConfirm={() => startDelete([...selectedIds])}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
