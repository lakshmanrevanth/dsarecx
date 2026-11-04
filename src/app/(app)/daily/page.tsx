'use client';

import useSWR, { useSWRConfig } from 'swr';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { format } from 'date-fns';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Keyboard, Layers, RotateCw } from 'lucide-react';
import { StatsStrip, GoalProgress } from '@/components/daily/stats-strip';
import { ProblemRevisionRow } from '@/components/daily/problem-row';
import { AllDone } from '@/components/daily/all-done';
import { EmptyState } from '@/components/daily/empty-state';
import { ContributionHeatmap } from '@/components/heatmap';
import { CompletedSection } from '@/components/daily/completed-section';
import { ToastStack, useToastStack } from '@/components/daily/toast-stack';
import { FocusDeck } from '@/components/daily/focus-deck';
import { ShortcutsHelp } from '@/components/daily/shortcuts-help';
import { isPlainShortcut, isTypingTarget, isUndoChord, RATING_KEYS } from '@/components/daily/keyboard';
import { applyDailyRating, applyDailyUndo, removeFromDue, type DailyItem, type DailySummary } from '@/components/daily/summary-state';
import { fetcher } from '@/lib/fetcher';
import { cn } from '@/lib/utils';

type Confidence = 'CLEAN' | 'SHAKY' | 'STRUGGLED';

/** Overdue backlogs show the weakest items first, this many at a time. */
const BATCH_SIZE = 20;

const SNOOZE_LABEL: Record<number, string> = { 1: 'to tomorrow', 2: 'for 2 days', 3: 'for 3 days', 7: 'for a week' };

// Daily goal saved by older versions of Settings in this browser; the server value wins.
function readLocalGoal(): number | null {
  try {
    const n = Number(localStorage.getItem('recall_daily_target'));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

const noopSubscribe = () => () => {};

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

const otherDailyKeys = (key: unknown) =>
  typeof key === 'string' &&
  (key.startsWith('/api/problems/due') || key.startsWith('/api/problems/revised-today') || key === '/api/streak' || key === '/api/problems');

function QueueSkeleton() {
  return (
    <div className="card overflow-hidden" aria-busy="true" aria-label="Loading today's queue">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-6 py-6 last:border-b-0">
          <div className="flex-1 space-y-2.5">
            <div className="skeleton h-4 w-2/5" />
            <div className="skeleton h-3 w-1/4" />
          </div>
          <div className="hidden gap-2 md:flex">
            <div className="skeleton h-9 w-24 rounded-full" />
            <div className="skeleton h-9 w-24 rounded-full" />
            <div className="skeleton h-9 w-28 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function GroupLabel({ tone, label, count }: { tone: 'overdue' | 'today'; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border bg-background/40 px-4 py-2.5 md:px-6">
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', tone === 'overdue' ? 'bg-error' : 'bg-ember')} />
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label} <span className="text-foreground">· {count}</span>
      </span>
    </div>
  );
}

export default function DailyRevisionPage() {
  const { mutate: globalMutate } = useSWRConfig();
  const reduceMotion = useReducedMotion();
  // SWR's cache lives in localStorage, so render data only after hydration.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const localGoal = useMemo(() => (mounted ? readLocalGoal() : null), [mounted]);

  // Re-render when the tab comes back into view on a new day, so a tab left open
  // overnight doesn't keep showing yesterday's queue.
  const [dayKey, setDayKey] = useState(() => new Date().toDateString());
  useEffect(() => {
    const check = () => {
      const k = new Date().toDateString();
      setDayKey((prev) => (prev === k ? prev : k));
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(check, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, []);

  // One request for the queue, today's ratings, streak, counts and ladder. dayKey refetches at midnight.
  const summaryUrl = mounted ? `/api/daily/summary?d=${encodeURIComponent(dayKey)}` : null;
  const { data: summary, error: summaryError, isValidating, mutate: mutateSummary } = useSWR<DailySummary>(summaryUrl, fetcher);
  const { data: activity, mutate: mutateActivity } = useSWR(mounted ? '/api/activity' : null, fetcher);

  const toastStack = useToastStack();
  const { push: pushToast, dismissUndoFor } = toastStack;
  const [pending, setPending] = useState<Record<string, Confidence>>({});
  const [showAll, setShowAll] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const focusButtonRef = useRef<HTMLButtonElement>(null);
  // Due rows as they were before rating, so an undo can put them back right away.
  const snapshots = useRef(new Map<string, DailyItem>());

  const showToast = useCallback(
    (message: string, kind: 'success' | 'error' = 'error') => pushToast({ kind, message }),
    [pushToast],
  );

  const patchSummary = useCallback(
    (fn: (s: DailySummary) => DailySummary) => mutateSummary((cur) => (cur ? fn(cur) : cur), { revalidate: false }),
    [mutateSummary],
  );

  const revalidateAll = useCallback(() => {
    mutateSummary();
    mutateActivity();
    globalMutate(otherDailyKeys);
  }, [mutateSummary, mutateActivity, globalMutate]);

  // ---------------------------------------------------------------------------
  // Derived lists
  // ---------------------------------------------------------------------------
  const due: DailyItem[] = Array.isArray(summary?.due) ? summary!.due : [];
  const completedList: DailyItem[] = Array.isArray(summary?.revisedToday) ? summary!.revisedToday : [];
  const ladder = summary?.ladder;
  const streakData = summary?.streak;
  const dailyGoal = streakData?.dailyGoal ?? localGoal ?? 5;
  const goalBasedStreak = !!streakData?.goalBasedStreak;

  const overdue = due.filter((p) => p.isOverdue);
  const dueToday = due.filter((p) => !p.isOverdue);
  const ordered = [...overdue, ...dueToday];
  const visible = showAll ? ordered : ordered.slice(0, BATCH_SIZE);
  const hiddenCount = ordered.length - visible.length;
  const visibleIds = new Set(visible.map((p) => p.id));
  const visibleOverdue = overdue.filter((p) => visibleIds.has(p.id));
  const visibleDueToday = dueToday.filter((p) => visibleIds.has(p.id));
  const rovingId = focusedId && visibleIds.has(focusedId) ? focusedId : (visible[0]?.id ?? null);

  const focusRow = useCallback((id: string | null | undefined) => {
    if (!id) return;
    setFocusedId(id);
    const el = document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`);
    el?.focus();
    el?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  // When a row leaves the list, keep keyboard focus in the queue on the next row.
  const keepFocusAfterRemoving = (id: string) => {
    const row = document.querySelector(`[data-row-id="${CSS.escape(id)}"]`);
    if (!row || !row.contains(document.activeElement)) return;
    const i = visible.findIndex((p) => p.id === id);
    const next = visible[i + 1] ?? visible[i - 1];
    if (next) requestAnimationFrame(() => focusRow(next.id));
  };

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const rate = async (problem: DailyItem, conf: Confidence) => {
    if (pending[problem.id]) return;
    setPending((p) => ({ ...p, [problem.id]: conf }));
    snapshots.current.set(problem.id, problem);
    keepFocusAfterRemoving(problem.id);
    // Optimistic: the row moves to "Completed today" at once.
    patchSummary((s) => applyDailyRating(s, problem, conf));
    try {
      const res = await fetch(`/api/problems/${problem.id}/revise`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confidence: conf }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Failed to submit revision');
      patchSummary((s) => applyDailyRating(s, problem, conf, j));
      pushToast({ kind: 'undo', problemId: problem.id, revisionId: j.revisionId ?? null, title: problem.title, confidence: conf });
    } catch (e) {
      showToast(errorMessage(e, 'Failed to submit revision'));
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[problem.id];
        return next;
      });
      revalidateAll();
    }
  };

  const undo = async (problemId: string, revisionId?: string | null) => {
    dismissUndoFor(problemId);
    const item = completedList.find((p) => p.id === problemId);
    const rid = revisionId ?? item?.latestRevision?.id ?? null;
    patchSummary((s) => applyDailyUndo(s, problemId, snapshots.current.get(problemId)));
    try {
      const res = await fetch(`/api/problems/${problemId}/undo-revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rid ? { revisionId: rid } : {}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to undo revision');
      }
      snapshots.current.delete(problemId);
      showToast(item?.title ? `Undid the rating for “${item.title}”` : 'Rating undone', 'success');
    } catch (e) {
      showToast(errorMessage(e, 'Failed to undo revision'));
    } finally {
      revalidateAll();
    }
  };

  const undoLatest = () => {
    const t = toastStack.latestUndo;
    if (t) return undo(t.problemId, t.revisionId);
    const item = completedList.find((p) => !pending[p.id]);
    if (item) return undo(item.id, item.latestRevision?.id);
    showToast('Nothing to undo today', 'success');
  };

  const changeConfidence = async (problemId: string, newConf: Confidence) => {
    patchSummary((s) => ({
      ...s,
      revisedToday: s.revisedToday.map((p) =>
        p.id === problemId ? { ...p, latestRevision: { ...(p.latestRevision ?? {}), confidence: newConf } } : p,
      ),
    }));
    try {
      const res = await fetch(`/api/problems/${problemId}/revise`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confidence: newConf, replaceLatest: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to update revision');
      }
      showToast(`Changed to ${newConf.charAt(0) + newConf.slice(1).toLowerCase()}`, 'success');
      revalidateAll();
    } catch (e) {
      mutateSummary();
      showToast(errorMessage(e, 'Failed to update status'));
      throw e;
    }
  };

  const snooze = async (problem: DailyItem, days: number) => {
    keepFocusAfterRemoving(problem.id);
    patchSummary((s) => removeFromDue(s, problem.id));
    try {
      const res = await fetch(`/api/problems/${problem.id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to snooze');
      }
      showToast(`Snoozed “${problem.title}” ${SNOOZE_LABEL[days] ?? `for ${days} days`}`, 'success');
    } catch (e) {
      showToast(errorMessage(e, 'Failed to snooze'));
    } finally {
      revalidateAll();
    }
  };

  const retire = async (problem: DailyItem) => {
    keepFocusAfterRemoving(problem.id);
    patchSummary((s) => removeFromDue(s, problem.id));
    try {
      const res = await fetch(`/api/problems/${problem.id}/retire`, { method: 'PATCH' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to retire');
      }
      showToast(`Retired “${problem.title}”. Set it back to Active from the problems table.`, 'success');
    } catch (e) {
      showToast(errorMessage(e, 'Failed to retire'));
    } finally {
      revalidateAll();
    }
  };

  const exitFocus = useCallback(() => {
    setFocusMode(false);
    requestAnimationFrame(() => focusButtonRef.current?.focus());
  }, []);

  // ---------------------------------------------------------------------------
  // Keyboard: j/k move, 1/2/3 rate the focused row, u / Ctrl+Z undo, ? help, f focus mode.
  // Focus mode handles its own keys (except Ctrl+Z).
  // ---------------------------------------------------------------------------
  const keyState = useRef({ visible, focusedId, focusMode, rate, undoLatest, focusRow, hasDue: ordered.length > 0 });
  useEffect(() => {
    keyState.current = { visible, focusedId, focusMode, rate, undoLatest, focusRow, hasDue: ordered.length > 0 };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = keyState.current;
      if (isUndoChord(e)) {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        s.undoLatest();
        return;
      }
      if (s.focusMode || !isPlainShortcut(e) || e.repeat) return;
      if ((e.target as HTMLElement)?.closest?.('[role="menu"], [role="dialog"]')) return;

      const ids = s.visible.map((p) => p.id);
      const idx = s.focusedId ? ids.indexOf(s.focusedId) : -1;
      if (e.key === 'j' || e.key === 'k') {
        if (ids.length === 0) return;
        e.preventDefault();
        const next = idx === -1 ? 0 : e.key === 'j' ? Math.min(idx + 1, ids.length - 1) : Math.max(idx - 1, 0);
        s.focusRow(ids[next]);
      } else if (RATING_KEYS[e.key]) {
        // Only when a row (or something inside it) has focus.
        const rowEl = (e.target as HTMLElement)?.closest?.('[data-row-id]');
        const id = rowEl?.getAttribute('data-row-id');
        const problem = id ? s.visible.find((p) => p.id === id) : null;
        if (!problem) return;
        e.preventDefault();
        s.rate(problem, RATING_KEYS[e.key]);
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        s.undoLatest();
      } else if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((v) => !v);
      } else if ((e.key === 'f' || e.key === 'F') && s.hasDue) {
        e.preventDefault();
        setFocusMode(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const isLoading = !mounted || (!summary && !summaryError);
  const isNewUser = summary?.counts?.total === 0;
  const streak = streakData?.currentStreak ?? 0;
  const reviewedToday = Math.max(streakData?.todayReviewed ?? 0, completedList.length);
  const goalMet = reviewedToday >= dailyGoal;
  const hasFinishedAll = due.length === 0 && completedList.length > 0;
  const todayKey = summary?.today ?? format(new Date(), 'yyyy-MM-dd');
  const streakRule = goalBasedStreak ? `a day counts when you review ${dailyGoal}` : 'a day counts when you review at least 1';
  const fade = { duration: reduceMotion ? 0 : 0.18 };

  const subtitle = !summary
    ? 'Recall first, then reveal your notes and rate how it went.'
    : ordered.length > 0
      ? `${ordered.length} ${ordered.length === 1 ? 'item' : 'items'} to review${overdue.length ? `, ${overdue.length} overdue` : ''}. Weakest memories first. Recall before you reveal.`
      : completedList.length > 0
        ? `You reviewed ${completedList.length} ${completedList.length === 1 ? 'item' : 'items'} today.`
        : 'Nothing is due right now.';

  const renderRow = (p: DailyItem) => (
    <ProblemRevisionRow
      key={p.id}
      problem={p}
      ladder={ladder}
      pendingConf={pending[p.id] ?? null}
      focused={rovingId === p.id}
      onRate={rate}
      onSnooze={snooze}
      onRetire={retire}
      onFocusRow={setFocusedId}
    />
  );

  return (
    <div className="pb-8">
      {/* Header */}
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">(01) Daily review</p>
          <p suppressHydrationWarning className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {mounted ? format(new Date(), 'EEEE, MMM d') : ' '}
          </p>
        </div>
        <h1 className="display mt-5 text-5xl text-foreground md:text-6xl">
          Today&apos;s <em>queue.</em>
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>
      </header>

      <div className="mt-8">
        <StatsStrip
          streak={streak}
          totalProblems={summary?.counts?.total ?? 0}
          masteredCount={summary?.counts?.mastered ?? 0}
          dueCount={due.length}
          overdueCount={overdue.length}
          todayCompleted={!!streakData?.todayCompleted}
          streakRule={summary ? streakRule : undefined}
        />
      </div>

      {/* Goal progress + the one primary action */}
      {mounted && summary && !isNewUser && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <GoalProgress reviewed={reviewedToday} goal={dailyGoal} />
          <div className="relative flex items-center gap-2">
            {ordered.length > 0 && !focusMode && (
              <button
                ref={focusButtonRef}
                type="button"
                onClick={() => setFocusMode(true)}
                aria-keyshortcuts="F"
                title="One card at a time (F)"
                className="btn btn-ember"
              >
                <Layers size={15} strokeWidth={1.75} aria-hidden />
                Start focus review
                <span aria-hidden className="kbd hidden border-white/30 bg-white/15 text-current sm:inline-grid">
                  F
                </span>
              </button>
            )}
            <button
              type="button"
              data-shortcuts-toggle
              onClick={() => setHelpOpen((v) => !v)}
              aria-expanded={helpOpen}
              aria-controls={helpOpen ? 'daily-shortcuts' : undefined}
              aria-label="Keyboard shortcuts"
              aria-keyshortcuts="Shift+?"
              title="Keyboard shortcuts (?)"
              className={cn('btn btn-outline btn-icon h-[38px] w-[38px]', helpOpen && 'bg-muted')}
            >
              <Keyboard size={16} strokeWidth={1.75} aria-hidden />
            </button>
            {helpOpen && <ShortcutsHelp id="daily-shortcuts" onClose={() => setHelpOpen(false)} />}
          </div>
        </div>
      )}

      {/* Queue */}
      <div className="mt-10">
        {!focusMode && <p className="eyebrow mb-4">(02) Queue</p>}
        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <motion.div key="loading" exit={{ opacity: 0 }} transition={fade}>
              <QueueSkeleton />
            </motion.div>
          ) : summaryError && !summary ? (
            <motion.div
              key="error"
              role="alert"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={fade}
              className="card border-error-border px-6 py-12 text-center"
            >
              <p className="eyebrow justify-center text-error">Couldn&apos;t load</p>
              <p className="mx-auto mt-4 max-w-sm text-[15px] text-foreground">
                Couldn&apos;t load today&apos;s reviews. Your progress is safe.
              </p>
              <button type="button" onClick={() => mutateSummary()} disabled={isValidating} className="btn btn-outline mt-6">
                <RotateCw size={14} strokeWidth={1.75} aria-hidden className={isValidating ? 'animate-spin' : ''} />
                {isValidating ? 'Retrying…' : 'Try again'}
              </button>
            </motion.div>
          ) : focusMode ? (
            <motion.div key="focus" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
              <FocusDeck
                problems={ordered}
                ladder={ladder}
                pendingConf={ordered[0] ? (pending[ordered[0].id] ?? null) : null}
                onRate={rate}
                onSnooze={(p, days) => snooze(p, days)}
                onUndo={undoLatest}
                onExit={exitFocus}
              />
            </motion.div>
          ) : due.length === 0 && completedList.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>
              <EmptyState isNewUser={isNewUser} upcoming={summary?.upcoming} todayKey={todayKey} ladder={ladder} />
            </motion.div>
          ) : hasFinishedAll ? (
            <AllDone
              key="done"
              streak={streak}
              upcoming={summary?.upcoming}
              todayKey={todayKey}
              goalMet={goalMet}
              goalBasedStreak={goalBasedStreak}
            />
          ) : (
            <motion.div
              data-daily-queue
              key="queue"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              // Visible overflow so row menus aren't clipped.
              className="card overflow-visible"
            >
              {visibleOverdue.length > 0 && (
                <div>
                  <GroupLabel tone="overdue" label="Overdue" count={overdue.length} />
                  {visibleOverdue.map(renderRow)}
                </div>
              )}
              {visibleDueToday.length > 0 && (
                <div className={cn(visibleOverdue.length > 0 && 'border-t border-border')}>
                  {visibleOverdue.length > 0 && <GroupLabel tone="today" label="Due today" count={dueToday.length} />}
                  {visibleDueToday.map(renderRow)}
                </div>
              )}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-b-[inherit] border-t border-border px-4 py-4 text-left transition-colors hover:bg-muted md:px-6"
                >
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Showing the {BATCH_SIZE} weakest first
                  </span>
                  <span className="text-[14px] font-medium text-foreground">Show {hiddenCount} more</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {mounted && !focusMode && (
        <CompletedSection problems={completedList} onUndo={(id) => undo(id)} onChangeConfidence={changeConfidence} />
      )}

      <div className="mt-14">
        <ContributionHeatmap activity={Array.isArray(activity) ? activity : []} index={completedList.length > 0 ? '04' : '03'} />
      </div>

      {mounted && <ToastStack toasts={toastStack.toasts} onDismiss={toastStack.dismiss} onUndo={(t) => undo(t.problemId, t.revisionId)} />}
    </div>
  );
}
