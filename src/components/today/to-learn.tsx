'use client';

// (03) To learn: quick-add, filter chips and the ordered backlog with
// Learned it / edit / delete (undo) / move up-down.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CodingPlatform, StudyItemWithFlags } from '@/lib/study';
import { cn } from '@/lib/utils';
import { learnConcept, learnDsa, type DsaDetails, type LearnOutcome } from './learn';
import { QuickAdd } from './quick-add';
import { StudyRow, type RowMode } from './study-row';
import type { KindFilter } from './types';

type Props = {
  items: StudyItemWithFlags[];
  today: string;
  defaultPlatform: CodingPlatform;
  /** Replace the list locally (optimistic); the page revalidates from the server. */
  setItems: (update: (items: StudyItemWithFlags[]) => StudyItemWithFlags[]) => void;
  refresh: () => void;
  /** After a problem or concept was created. */
  onLearned: () => void;
  notify: (message: string, opts?: { tone?: 'error'; action?: { label: string; onClick: () => void } }) => void;
};

const UNDO_MS = 6000;

async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive: method === 'DELETE',
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json };
  } catch {
    return { ok: false, json: { error: 'Network error. Check your connection.' } };
  }
}

const errorOf = (json: Record<string, unknown>, fallback: string) => (typeof json.error === 'string' && json.error) || fallback;

export function ToLearn({ items, today, defaultPlatform, setItems, refresh, onLearned, notify }: Props) {
  const [filter, setFilter] = useState<KindFilter>('ALL');
  const [modes, setModes] = useState<Record<string, RowMode>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const deleteTimers = useRef(new Map<string, number>());
  const focusAfterMove = useRef<{ id: string; dir: 'up' | 'down' } | null>(null);

  const visibleAll = useMemo(() => items.filter((i) => !hidden.has(i.id)), [items, hidden]);
  const shown = useMemo(() => (filter === 'ALL' ? visibleAll : visibleAll.filter((i) => i.kind === filter)), [visibleAll, filter]);
  const counts = useMemo(
    () => ({
      ALL: visibleAll.length,
      DSA: visibleAll.filter((i) => i.kind === 'DSA').length,
      SYSTEM_DESIGN: visibleAll.filter((i) => i.kind === 'SYSTEM_DESIGN').length,
    }),
    [visibleAll]
  );

  const setMode = (id: string, mode: RowMode) => setModes((m) => ({ ...m, [id]: mode }));
  const setBusyFor = (id: string, value: boolean) => setBusy((b) => ({ ...b, [id]: value }));

  // Pending deletes go through when the page unmounts.
  useEffect(() => {
    const timers = deleteTimers.current;
    return () => {
      timers.forEach((timer, id) => {
        window.clearTimeout(timer);
        void send(`/api/study/${id}`, 'DELETE');
      });
      timers.clear();
    };
  }, []);

  // Keep keyboard focus on the moved row's arrow (or its other arrow at the ends).
  useLayoutEffect(() => {
    const req = focusAfterMove.current;
    if (!req) return;
    focusAfterMove.current = null;
    const pick = (dir: string) => document.querySelector<HTMLButtonElement>(`[data-move="${req.id}-${dir}"]`);
    const primary = pick(req.dir);
    (primary && !primary.disabled ? primary : pick(req.dir === 'up' ? 'down' : 'up'))?.focus();
  });

  const add = async (body: Record<string, unknown>) => {
    const { ok, json } = await send('/api/study', 'POST', body);
    if (!ok) {
      notify(errorOf(json, 'Could not add it'), { tone: 'error' });
      return false;
    }
    setItems((list) => [...list, json as unknown as StudyItemWithFlags]);
    if (filter !== 'ALL' && filter !== body.kind) setFilter('ALL');
    notify(`Added “${String(json.title ?? body.title)}”`);
    refresh();
    return true;
  };

  const save = async (item: StudyItemWithFlags, patch: Record<string, unknown>) => {
    const { ok, json } = await send(`/api/study/${item.id}`, 'PATCH', patch);
    if (!ok) {
      notify(errorOf(json, 'Could not save'), { tone: 'error' });
      return false;
    }
    setItems((list) => list.map((i) => (i.id === item.id ? (json as unknown as StudyItemWithFlags) : i)));
    notify('Saved');
    return true;
  };

  const remove = (item: StudyItemWithFlags) => {
    setHidden((h) => new Set(h).add(item.id));
    const timer = window.setTimeout(async () => {
      deleteTimers.current.delete(item.id);
      const { ok } = await send(`/api/study/${item.id}`, 'DELETE');
      if (!ok) notify('Could not delete it', { tone: 'error' });
      setItems((list) => list.filter((i) => i.id !== item.id));
      setHidden((h) => {
        const next = new Set(h);
        next.delete(item.id);
        return next;
      });
      refresh();
    }, UNDO_MS);
    deleteTimers.current.set(item.id, timer);
    notify(`Deleted “${item.title}”`, {
      action: {
        label: 'Undo',
        onClick: () => {
          window.clearTimeout(deleteTimers.current.get(item.id));
          deleteTimers.current.delete(item.id);
          setHidden((h) => {
            const next = new Set(h);
            next.delete(item.id);
            return next;
          });
        },
      },
    });
  };

  const finishLearn = async (item: StudyItemWithFlags, outcome: LearnOutcome) => {
    if (outcome.status === 'needs-details') return setMode(item.id, { type: 'details', prefill: outcome.prefill, message: outcome.message });
    if (outcome.status === 'needs-category') return setMode(item.id, { type: 'category' });
    if (outcome.status === 'error') {
      notify(outcome.message, { tone: 'error' });
      return;
    }
    // Learned (or already tracked): the backlog item is done.
    setMode(item.id, { type: 'view' });
    setItems((list) => list.filter((i) => i.id !== item.id));
    await send(`/api/study/${item.id}`, 'DELETE');
    notify(outcome.status === 'learned' ? `Learned “${item.title}”. First review is scheduled.` : `${outcome.message}. Removed from your list.`);
    onLearned();
  };

  const learn = async (item: StudyItemWithFlags, extra?: { details?: DsaDetails; category?: string }) => {
    setBusyFor(item.id, true);
    try {
      const outcome =
        item.kind === 'DSA' ? await learnDsa(item, extra?.details) : await learnConcept(item, extra?.category);
      await finishLearn(item, outcome);
    } catch {
      notify('Could not save it. Check your connection.', { tone: 'error' });
    } finally {
      setBusyFor(item.id, false);
    }
  };

  const move = async (item: StudyItemWithFlags, dir: 'up' | 'down') => {
    const pos = shown.findIndex((i) => i.id === item.id);
    const neighbour = shown[dir === 'up' ? pos - 1 : pos + 1];
    if (!neighbour) return;
    const ids = items.map((i) => i.id);
    const a = ids.indexOf(item.id);
    const b = ids.indexOf(neighbour.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    const byId = new Map(items.map((i) => [i.id, i]));
    focusAfterMove.current = { id: item.id, dir };
    setItems(() => ids.map((id, order) => ({ ...byId.get(id)!, order })));
    const { ok } = await send('/api/study', 'PATCH', { ids });
    if (!ok) {
      notify('Could not reorder. Refreshing the list.', { tone: 'error' });
      refresh();
    }
  };

  const FILTERS: { value: KindFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'DSA', label: 'DSA' },
    { value: 'SYSTEM_DESIGN', label: 'System design' },
  ];

  return (
    <div>
      <QuickAdd today={today} defaultPlatform={defaultPlatform} onAdd={add} />

      <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Show">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'chip h-8 cursor-pointer px-3.5 text-[13px] transition-colors',
              filter === f.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-border-strong hover:text-foreground'
            )}
          >
            {f.label}
            <span className={cn('font-mono text-[11px]', filter === f.value ? 'opacity-80' : 'text-faint')}>{counts[f.value]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-[14px] text-muted-foreground">
          {visibleAll.length === 0
            ? 'Your list is empty. Add the next problem or concept you want to learn, and tick it off when you have.'
            : 'Nothing here for this filter.'}
        </p>
      ) : (
        <ol className="mt-3" aria-label="To learn">
          {shown.map((item, i) => (
            <StudyRow
              key={item.id}
              item={item}
              today={today}
              mode={modes[item.id] ?? { type: 'view' }}
              busy={!!busy[item.id]}
              canMoveUp={i > 0}
              canMoveDown={i < shown.length - 1}
              onModeChange={(m) => setMode(item.id, m)}
              onLearn={() => learn(item)}
              onLearnWithDetails={(details) => learn(item, { details })}
              onLearnWithCategory={(category) => learn(item, { category })}
              onSave={(patch) => save(item, patch)}
              onDelete={() => remove(item)}
              onMove={(dir) => move(item, dir)}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
