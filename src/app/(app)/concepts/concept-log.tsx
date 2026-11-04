'use client';

// "Library & log" tab: log any concept (from the built-in library of 58, or your own),
// see every tracked concept with its place on the review ladder, and browse the library.

import { useId, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ArrowUpRight, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CONCEPTS,
  CONCEPT_CATEGORIES,
  searchConcepts,
  type Concept,
  type ConceptLevel,
} from '@/lib/concepts/library';
import {
  LEVEL_LABEL,
  firstReviewPhrase,
  isDue,
  localDateKey,
  nextReviewText,
  postConcept,
  type TrackedConcept,
} from './shared';

const LEVELS: ConceptLevel[] = ['EASY', 'MEDIUM', 'HARD'];

function LadderDots({ step, status }: { step: number; status: TrackedConcept['status'] }) {
  const full = status === 'MASTERED';
  return (
    <span role="img" aria-label={full ? 'Mastered' : `Step ${step + 1} of 4`} className="inline-flex items-center gap-1">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          aria-hidden
          className={cn('h-1.5 w-4 rounded-full', full ? 'bg-success' : i <= step ? 'bg-foreground/80' : 'bg-border')}
        />
      ))}
    </span>
  );
}

export function ConceptLog({
  tracked,
  loading,
  failed,
  onSaved,
}: {
  tracked: TrackedConcept[];
  loading: boolean;
  failed: boolean;
  onSaved: () => void;
}) {
  const trackedSlugs = useMemo(() => new Set(tracked.map((c) => c.code).filter(Boolean)), [tracked]);
  const listboxId = useId();

  // Form state
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Concept | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [category, setCategory] = useState<string>('Fundamentals');
  const [level, setLevel] = useState<ConceptLevel>('MEDIUM');
  const [learnedOn, setLearnedOn] = useState(localDateKey());
  const [notes, setNotes] = useState('');
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<string>('All');
  const titleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLElement>(null);

  const suggestions = useMemo(() => searchConcepts(query, 8), [query]);
  const listOpen = showSuggestions && suggestions.length > 0;

  const pick = (c: Concept) => {
    setPicked(c);
    setQuery(c.title);
    setCategory(c.category);
    setLevel(c.level);
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  const resetForm = () => {
    setPicked(null);
    setQuery('');
    setNotes('');
    setLink('');
    setLearnedOn(localDateKey());
  };

  const save = async (override?: { slug: string }) => {
    setMessage(null);
    if (!override && !query.trim()) {
      setMessage({ kind: 'error', text: 'Type the concept you learned, or pick one from the library.' });
      titleRef.current?.focus();
      return;
    }
    const body = override
      ? { slug: override.slug, learnedOn: localDateKey() }
      : picked && picked.title === query.trim()
        ? { slug: picked.slug, notes, learnedOn, url: link, level }
        : { title: query.trim(), category, level, notes, learnedOn, url: link };
    setSaving(true);
    try {
      const json = await postConcept(body);
      setMessage({ kind: 'success', text: `Saved “${json.title}”. First review ${firstReviewPhrase(json.nextRevisionAt)}.` });
      if (!override) resetForm();
      onSaved();
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  const onTitleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
      return;
    }
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowSuggestions(true);
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setShowSuggestions(true);
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && listOpen && activeIndex >= 0) {
      e.preventDefault();
      pick(suggestions[activeIndex]);
    }
  };

  const dueNow = tracked.filter(isDue);
  const upcoming = tracked
    .filter((c) => c.status !== 'RETIRED' && !dueNow.includes(c))
    .sort((a, b) => +new Date(a.nextRevisionAt) - +new Date(b.nextRevisionAt));
  const ordered = [...dueNow, ...upcoming, ...tracked.filter((c) => c.status === 'RETIRED')];
  const libraryList = CONCEPTS.filter((c) => libraryFilter === 'All' || c.category === libraryFilter);
  const todayKey = localDateKey();

  return (
    <div className="grid gap-14">
      {/* (01) Log form */}
      <section ref={formRef} aria-labelledby="log-heading" className="scroll-mt-24">
        <p className="eyebrow">(01) Log a concept</p>
        <h2 id="log-heading" className="display mt-3 text-3xl md:text-4xl">
          What did you <em>learn?</em>
        </h2>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="card mt-6 grid gap-5 p-5 sm:p-7"
        >
          <div className="relative">
            <label htmlFor="concept-title" className="label">
              Concept
            </label>
            <input
              id="concept-title"
              ref={titleRef}
              value={query}
              autoComplete="off"
              placeholder="e.g. Consistent hashing, CAP theorem, Design a chat system…"
              role="combobox"
              aria-expanded={listOpen}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={listOpen && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
              onChange={(e) => {
                setQuery(e.target.value);
                if (picked && e.target.value !== picked.title) setPicked(null);
                setShowSuggestions(true);
                setActiveIndex(-1);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={onTitleKey}
              className="field h-11 text-[15px]"
            />
            {listOpen && (
              <ul id={listboxId} role="listbox" aria-label="Library suggestions" className="menu absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto">
                {suggestions.map((c, i) => (
                  <li
                    key={c.slug}
                    id={`${listboxId}-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    data-highlighted={i === activeIndex ? '' : undefined}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => pick(c)}
                    className="menu-item justify-between"
                  >
                    <span className="min-w-0 truncate">
                      {c.title}
                      {trackedSlugs.has(c.slug) && <span className="text-faint"> · tracked</span>}
                    </span>
                    <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">{c.category}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {picked && (
            <div className="border-l-2 border-ember/40 pl-4 text-[14px] leading-relaxed">
              <p className="text-foreground">{picked.summary}</p>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">You&apos;ll be asked to recall</p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 marker:font-mono marker:text-[12px] marker:text-faint">
                {picked.prompts.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label htmlFor="concept-category" className="label">
                Category
              </label>
              <select
                id="concept-category"
                value={category}
                disabled={!!picked}
                onChange={(e) => setCategory(e.target.value)}
                className="field disabled:cursor-not-allowed disabled:opacity-60"
              >
                {CONCEPT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="concept-level" className="label">
                Level
              </label>
              <select id="concept-level" value={level} onChange={(e) => setLevel(e.target.value as ConceptLevel)} className="field">
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABEL[l]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="concept-date" className="label">
                Learned on
              </label>
              <input
                id="concept-date"
                type="date"
                value={learnedOn}
                max={todayKey}
                onChange={(e) => setLearnedOn(e.target.value)}
                className="field font-mono text-[13px]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="concept-notes" className="label">
              Your notes <span className="normal-case tracking-normal text-faint">(key ideas, trade-offs, a diagram in words)</span>
            </label>
            <textarea
              id="concept-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Write it in your own words. This is what you'll reveal when it's time to review."
              className="field"
            />
          </div>

          <div>
            <label htmlFor="concept-link" className="label">
              Source link <span className="normal-case tracking-normal text-faint">(optional)</span>
            </label>
            <input
              id="concept-link"
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://… (article, video or book chapter)"
              className="field"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-border pt-5">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving…' : 'Save and schedule reviews'}
            </button>
            <div
              role="status"
              aria-live="polite"
              className={cn('text-[13.5px]', message?.kind === 'error' ? 'text-error' : 'text-muted-foreground')}
            >
              {message?.kind === 'success' && <Check size={14} strokeWidth={2} className="mr-1.5 inline text-success" aria-hidden />}
              {message?.text}
            </div>
          </div>
        </form>
      </section>

      {/* (02) Tracked concepts */}
      <section aria-labelledby="tracked-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">(02) Your concepts</p>
            <h2 id="tracked-heading" className="display mt-3 text-3xl md:text-4xl">
              On the <em>ladder.</em>
            </h2>
          </div>
          {tracked.length > 0 && (
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {tracked.length} tracked · {dueNow.length} due
            </p>
          )}
        </div>

        <div className="mt-6">
          {failed ? (
            <p className="text-[14px] text-muted-foreground">Your concepts couldn&apos;t be loaded. Use “Try again” above.</p>
          ) : loading ? (
            <div className="grid gap-3" aria-busy="true" aria-label="Loading your concepts">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-14" />
              ))}
            </div>
          ) : tracked.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-strong px-5 py-8 text-center">
              <p className="display text-2xl">Nothing logged yet.</p>
              <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
                Add the first concept you learned today above, pick one from the library below, or start a learning path.
              </p>
            </div>
          ) : (
            <ul className="border-t border-border">
              {ordered.map((c) => {
                const due = isDue(c);
                return (
                  <li key={c.id} className="border-b border-border">
                    <details className="group">
                      <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-4 transition-colors hover:bg-ember/[0.03] sm:grid-cols-[minmax(0,1fr)_auto_auto_12rem] sm:px-2 [&::-webkit-details-marker]:hidden">
                        <span className="flex min-w-0 items-center gap-2">
                          <ChevronDown
                            size={16}
                            strokeWidth={1.75}
                            aria-hidden
                            className="shrink-0 -rotate-90 text-faint transition-transform duration-150 group-open:rotate-0"
                          />
                          <span className="truncate text-[15px] font-medium text-foreground">{c.title}</span>
                        </span>
                        <span className="hidden truncate font-mono text-[11px] uppercase tracking-[0.1em] text-faint sm:block">
                          {c.topic} · {LEVEL_LABEL[c.difficulty]}
                        </span>
                        <LadderDots step={c.currentStep} status={c.status} />
                        <span
                          className={cn(
                            'col-span-2 pl-6 text-[12.5px] sm:col-span-1 sm:pl-0 sm:text-right',
                            due ? 'font-medium text-ember-strong' : 'text-muted-foreground'
                          )}
                        >
                          {due && <span className="ember-dot mr-2 h-1.5 w-1.5 align-middle" aria-hidden />}
                          {nextReviewText(c)}
                        </span>
                      </summary>
                      <div className="pb-5 pl-6 pr-2 text-[14px] leading-relaxed sm:pl-8">
                        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                          <span className="sm:hidden">
                            {c.topic} · {LEVEL_LABEL[c.difficulty]} ·{' '}
                          </span>
                          Learned {format(new Date(c.dateSolved), 'MMM d, yyyy')} · reviewed {c.revisionCount}{' '}
                          {c.revisionCount === 1 ? 'time' : 'times'}
                          {c.revisions[0] && ` · last: ${c.revisions[0].confidence.toLowerCase()}`}
                        </p>
                        {c.notes ? (
                          <p className="mt-3 whitespace-pre-wrap text-foreground">{c.notes}</p>
                        ) : (
                          <p className="mt-3 text-faint">No notes.</p>
                        )}
                        {c.url && (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-underline mt-4 text-[13px]"
                          >
                            Open source <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
                          </a>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* (03) Library */}
      <section aria-labelledby="library-heading">
        <p className="eyebrow">(03) Concept library</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <h2 id="library-heading" className="display text-3xl md:text-4xl">
            {CONCEPTS.length} concepts, <em>ten shelves.</em>
          </h2>
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground sm:hidden">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em]">Category</span>
            <select value={libraryFilter} onChange={(e) => setLibraryFilter(e.target.value)} className="field h-9 w-auto">
              <option value="All">All</option>
              {CONCEPT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div role="group" aria-label="Filter library by category" className="mt-5 hidden flex-wrap gap-2 sm:flex">
          {['All', ...CONCEPT_CATEGORIES].map((c) => {
            const active = libraryFilter === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => setLibraryFilter(c)}
                className={cn(
                  'chip cursor-pointer transition-colors duration-150',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-border-strong hover:text-foreground'
                )}
              >
                {c}
              </button>
            );
          })}
        </div>

        <ul className="mt-6 grid border-t border-border md:grid-cols-2 md:gap-x-10">
          {libraryList.map((c) => {
            const isTracked = trackedSlugs.has(c.slug);
            return (
              <li key={c.slug} className="flex flex-col gap-1.5 border-b border-border py-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[15px] font-medium text-foreground">{c.title}</h3>
                  <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">{LEVEL_LABEL[c.level]}</span>
                </div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">{c.category}</p>
                <p className="flex-1 text-[13.5px] leading-relaxed text-muted-foreground">{c.summary}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {isTracked ? (
                    <span className="chip chip-success">
                      <Check size={12} strokeWidth={2} aria-hidden /> Tracked
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => save({ slug: c.slug })}
                        className="btn btn-outline btn-sm"
                        aria-label={`I learned ${c.title} today`}
                      >
                        Learned today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          pick(c);
                          formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          setTimeout(() => document.getElementById('concept-notes')?.focus({ preventScroll: true }), 350);
                        }}
                        className="btn btn-ghost btn-sm"
                        aria-label={`Add notes for ${c.title}`}
                      >
                        Add with notes
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
