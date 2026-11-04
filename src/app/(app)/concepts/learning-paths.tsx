'use client';

// Learning paths: read each path top to bottom, one article at a time.
// Marking an article as learned turns it into a concept on the review ladder
// and unlocks the next article in that path (the server enforces the order).

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, ArrowUpRight, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LEARNING_PATHS,
  PATHS_SOURCE,
  pathCode,
  promptsFor,
  type LearningPath,
  type PathArticle,
} from '@/lib/concepts/paths';
import { isDue, nextReviewText, noopSubscribe, pad2, postConcept, type ConceptStatus } from './shared';

export type TrackedForPaths = {
  id: string;
  code: string | null;
  dateSolved: string;
  status: ConceptStatus;
  nextRevisionAt: string;
};

const STORAGE_KEY = 'dsarecx_selected_path';
const KIND_LABEL: Record<PathArticle['kind'], string> = { hld: 'HLD', lld: 'LLD', concept: 'Concept' };

// The open path is remembered in this browser. useSyncExternalStore reads it without a
// hydration mismatch (the server render sees null).
function readStoredPath(): string | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && LEARNING_PATHS.some((p) => p.slug === saved) ? saved : null;
  } catch {
    return null;
  }
}

/** Hairline progress rule with an ember fill. */
function ProgressRule({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  const complete = max > 0 && value === max;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} of ${max} learned`}
      className={cn('relative h-[3px] w-full overflow-hidden rounded-full bg-border', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', complete ? 'bg-success' : 'bg-ember')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** "04 / 12" in mono. */
function Fraction({ value, max, className }: { value: number; max: number; className?: string }) {
  return (
    <span className={cn('font-mono text-[12px] tabular-nums tracking-[0.08em] text-muted-foreground', className)}>
      <span className={value > 0 ? 'text-foreground' : undefined}>{pad2(value)}</span>
      <span className="px-1 text-faint">/</span>
      {pad2(max)}
    </span>
  );
}

export function LearningPaths({
  tracked,
  loading,
  onLearned,
}: {
  tracked: TrackedForPaths[];
  loading: boolean;
  onLearned: () => void;
}) {
  const byCode = useMemo(() => {
    const m = new Map<string, TrackedForPaths>();
    for (const c of tracked) if (c.code?.startsWith('path:')) m.set(c.code, c);
    return m;
  }, [tracked]);

  const learnedIn = (p: LearningPath) => p.articles.filter((a) => byCode.has(pathCode(a.id))).length;
  const totalArticles = LEARNING_PATHS.reduce((n, p) => n + p.articles.length, 0);
  const totalLearned = LEARNING_PATHS.reduce((n, p) => n + learnedIn(p), 0);
  const overallPct = totalArticles ? Math.round((totalLearned / totalArticles) * 100) : 0;

  const stored = useSyncExternalStore(noopSubscribe, readStoredPath, () => null);
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  const selected = choice === undefined ? stored : choice;
  const open = (slug: string | null) => {
    setChoice(slug);
    try {
      if (slug) localStorage.setItem(STORAGE_KEY, slug);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable
    }
    window.scrollTo({ top: 0 });
  };

  const path = LEARNING_PATHS.find((p) => p.slug === selected);

  return (
    <section aria-label="Learning paths">
      {path ? (
        <PathDetail
          path={path}
          index={LEARNING_PATHS.indexOf(path)}
          byCode={byCode}
          loading={loading}
          onBack={() => open(null)}
          onLearned={onLearned}
        />
      ) : (
        <>
          {/* Overall progress */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">(01) Learning paths</p>
              <h2 className="display mt-3 text-3xl md:text-4xl">
                Seven paths, <em>in order.</em>
              </h2>
            </div>
            <div className="text-right">
              <Fraction value={totalLearned} max={totalArticles} className="text-[13px]" />
              <p className="mt-1 text-[13px] text-muted-foreground">
                {loading ? 'Loading progress…' : `${overallPct}% of all articles learned`}
              </p>
            </div>
          </div>
          <ProgressRule value={totalLearned} max={totalArticles} label="Overall progress" className="mt-5" />

          {/* Table of contents */}
          <ol className="mt-8 border-t border-border">
            {LEARNING_PATHS.map((p, i) => {
              const done = learnedIn(p);
              const total = p.articles.length;
              const status = done === 0 ? 'Not started' : done === total ? 'Completed' : 'In progress';
              const next = p.articles.find((a) => !byCode.has(pathCode(a.id)));
              return (
                <li key={p.slug} className="border-b border-border">
                  <button
                    type="button"
                    onClick={() => open(p.slug)}
                    aria-label={`${p.title}: ${done} of ${total} learned. Open path.`}
                    className="group grid w-full grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 py-6 text-left transition-colors duration-150 hover:bg-ember/[0.035] sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:gap-x-5 sm:px-2"
                  >
                    <span className="pt-1.5 font-mono text-[13px] tabular-nums text-faint group-hover:text-ember">{pad2(i + 1)}</span>
                    <span className="flex min-w-0 flex-col gap-2">
                      <span className="display text-[26px] leading-[1.05] md:text-[30px]">{p.title}</span>
                      <span className="text-[14px] leading-relaxed text-muted-foreground">{p.description}</span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
                        <span>{p.levelLabel}</span>
                        <span aria-hidden>·</span>
                        <span>{total} articles</span>
                        {next && done > 0 && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="normal-case tracking-normal text-[12px] font-sans text-muted-foreground">
                              Up next: <span className="text-foreground">{next.title}</span>
                            </span>
                          </>
                        )}
                      </span>
                      <ProgressRule value={done} max={total} label={`${p.title} progress`} className="mt-2 sm:hidden" />
                    </span>
                    <span className="col-start-2 mt-3 flex items-center gap-3 sm:col-start-3 sm:mt-0 sm:w-36 sm:flex-col sm:items-end sm:gap-2 sm:pt-2">
                      <Fraction value={done} max={total} className="text-[13px]" />
                      <span
                        className={cn(
                          'chip chip-mono',
                          status === 'Completed' && 'chip-success',
                          status === 'In progress' && 'chip-ember'
                        )}
                      >
                        {status}
                      </span>
                      <ProgressRule value={done} max={total} label={`${p.title} progress`} className="hidden sm:block" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <Attribution />
    </section>
  );
}

function Attribution() {
  return (
    <p className="mt-10 border-t border-border pt-5 text-[12.5px] leading-relaxed text-muted-foreground">
      Paths and articles by <span className="text-foreground">{PATHS_SOURCE.author}</span> on{' '}
      <a
        href={PATHS_SOURCE.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-ember"
      >
        {PATHS_SOURCE.name}
      </a>
      . Only titles and one-line summaries are kept here; every article opens on the original site.
    </p>
  );
}

function PathDetail({
  path,
  index,
  byCode,
  loading,
  onBack,
  onLearned,
}: {
  path: LearningPath;
  index: number;
  byCode: Map<string, TrackedForPaths>;
  loading: boolean;
  onBack: () => void;
  onLearned: () => void;
}) {
  const total = path.articles.length;
  const done = path.articles.filter((a) => byCode.has(pathCode(a.id))).length;
  const nextIndex = loading ? -2 : path.articles.findIndex((a) => !byCode.has(pathCode(a.id)));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  // The "Mark learned" button moves to the next article once one is learned, so put
  // focus on the confirmation instead of losing it.
  const messageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) messageRef.current?.focus();
  }, [message]);

  const markLearned = async (article: PathArticle) => {
    setSaving(true);
    setMessage(null);
    try {
      const json = await postConcept({ pathArticleId: article.id, notes });
      const due = new Date(json.nextRevisionAt);
      const following = path.articles[article.position];
      setMessage({
        kind: 'success',
        text: `Learned “${article.title}”. First review ${format(due, 'EEE, MMM d')}.${
          following ? ` Next up: ${following.title}.` : ' Path complete!'
        }`,
      });
      setNotes('');
      onLearned();
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <button type="button" onClick={onBack} className="btn btn-ghost btn-sm -ml-3">
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden /> All paths
      </button>

      <div className="mt-6 grid gap-6 border-b border-border pb-8 md:grid-cols-[minmax(0,1fr)_14rem] md:items-end">
        <div>
          <p className="eyebrow">
            ({pad2(index + 1)}) {path.levelLabel} · {total} articles
          </p>
          <h2 className="display mt-4 text-4xl md:text-5xl">{path.title}</h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{path.description}</p>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <div className="flex items-baseline gap-3">
            <Fraction value={done} max={total} className="text-[13px]" />
            <span className="text-[13px] text-muted-foreground">learned · {Math.round((done / total) * 100)}%</span>
          </div>
          <ProgressRule value={done} max={total} label={`${path.title} progress`} />
        </div>
      </div>

      <div role="status" aria-live="polite">
        {message && (
          <div
            ref={messageRef}
            tabIndex={-1}
            className={cn(
              'mt-6 flex items-start gap-3 rounded-lg border px-4 py-3 text-[14px] leading-relaxed outline-none',
              message.kind === 'error'
                ? 'border-error-border bg-error-bg text-error'
                : 'border-success-border bg-success-bg text-foreground'
            )}
          >
            {message.kind === 'success' && <Check size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-success" aria-hidden />}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      <ol className="mt-2">
        {path.articles.map((a, i) => {
          const learned = byCode.get(pathCode(a.id));
          const isNext = i === nextIndex;
          const locked = !learned && !isNext && !loading;
          return (
            <li
              key={a.id}
              aria-current={isNext ? 'step' : undefined}
              className={cn(
                'relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 border-b border-border sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-x-5',
                isNext ? '-mx-4 my-3 rounded-xl border border-ember/30 bg-card px-4 py-6 shadow-card sm:-mx-5 sm:px-5' : 'py-5'
              )}
            >
              {/* Number column */}
              <span aria-hidden className="flex flex-col items-start pt-1">
                {learned ? (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-success-bg text-success">
                    <Check size={13} strokeWidth={2} />
                  </span>
                ) : isNext ? (
                  <span className="flex items-center gap-2 font-mono text-[13px] tabular-nums text-ember">
                    <span className="ember-dot ember-dot-pulse" />
                  </span>
                ) : (
                  <span className="font-mono text-[13px] tabular-nums text-faint">{pad2(a.position)}</span>
                )}
              </span>

              <div className={cn('min-w-0', locked && 'opacity-60')}>
                {isNext && (
                  <p className="eyebrow eyebrow-plain mb-2 text-ember-strong">
                    Up next · {pad2(a.position)} / {pad2(total)}
                  </p>
                )}
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className={cn(isNext ? 'display text-[28px] leading-tight md:text-[32px]' : 'text-[15px] font-medium text-foreground')}>
                    {a.title}
                  </h3>
                  <span className="chip chip-mono h-5 px-2 text-[10px]">{KIND_LABEL[a.kind]}</span>
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{a.summary}</p>

                {learned && (
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                    <span>Learned {format(new Date(learned.dateSolved), 'MMM d')}</span>
                    <span className={cn(isDue(learned) && 'text-ember-strong')}>{nextReviewText(learned, false)}</span>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-ember"
                      aria-label={`Re-read ${a.title} (opens the original site)`}
                    >
                      Re-read <ArrowUpRight size={12} strokeWidth={1.75} aria-hidden />
                    </a>
                  </p>
                )}

                {locked && i > 0 && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-faint">
                    <Lock size={12} strokeWidth={1.75} aria-hidden />
                    Unlocks after “{path.articles[i - 1].title}”
                  </p>
                )}

                {isNext && (
                  <div className="mt-5 grid gap-5">
                    <div className="border-l-2 border-ember/40 pl-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        After reading, you&apos;ll be asked to recall
                      </p>
                      <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-foreground marker:font-mono marker:text-[12px] marker:text-faint">
                        {promptsFor(a).map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ol>
                    </div>
                    <div>
                      <label htmlFor={`notes-${a.id}`} className="label">
                        Your notes <span className="normal-case tracking-normal text-faint">(optional, in your own words)</span>
                      </label>
                      <textarea
                        id={`notes-${a.id}`}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="What you took away. This is what you'll reveal when it's time to review."
                        className="field"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                        Read article <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden />
                      </a>
                      <button type="button" onClick={() => markLearned(a)} disabled={saving} className="btn btn-ember">
                        {saving ? 'Saving…' : 'Mark learned'}
                      </button>
                      <span className="text-[12.5px] text-faint">Adds it to your reviews from today.</span>
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {nextIndex === -1 && (
        <div className="mt-8 rounded-xl border border-success-border bg-success-bg px-5 py-5">
          <p className="display text-2xl">
            Path <em>complete.</em>
          </p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            You&apos;ve learned every article in this path. Keep up with the reviews in your Daily queue.
          </p>
        </div>
      )}
    </div>
  );
}
