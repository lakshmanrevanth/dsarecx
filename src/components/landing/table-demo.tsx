'use client';

import { useId, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INITIAL_ROWS, LADDER_DAYS, difficultyChip, lookupDemo, type TableRow } from './demo-data';

const SUGGESTIONS = ['42', '146', '200', '4A', 'leetcode.com/problems/3sum'];

/**
 * A small, working copy of the tracker: add a problem by number, code or URL
 * and it fills in; click the custom "Pattern" cell to edit it.
 * A table from md up, a card list below.
 */
export function TableDemo() {
  const [rows, setRows] = useState<TableRow[]>(INITIAL_ROWS);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [fresh, setFresh] = useState<string | null>(null);
  const inputId = useId();
  const counter = useRef(0);

  function add(q = query) {
    const found = lookupDemo(q);
    if (!q.trim()) return;
    if (!found) {
      setMessage(`“${q.trim()}” isn't in this demo's index. Try one of the suggestions. In the app, 18,000+ problems resolve, and anything else can be typed in by hand.`);
      return;
    }
    if (rows.some((r) => r.key === found.key && r.platform === found.platform)) {
      setMessage(`${found.title} is already in your tracker.`);
      return;
    }
    counter.current += 1;
    const id = `new-${counter.current}`;
    setRows((rs) => [{ ...found, id, nextReview: `In ${LADDER_DAYS[0]} days`, step: 0 }, ...rs]);
    setFresh(id);
    setQuery('');
    setMessage(`Added ${found.title}: ${found.difficulty}, ${found.topic}. First review in ${LADDER_DAYS[0]} days.`);
  }

  function updatePattern(id: string, pattern: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, pattern } : r)));
  }

  function remove(id: string) {
    const row = rows.find((r) => r.id === id);
    setRows((rs) => rs.filter((r) => r.id !== id));
    if (row) setMessage(`Removed ${row.title}.`);
  }

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-border p-4 sm:p-5">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            Add a problem by number, code or URL
          </label>
          <input
            id={inputId}
            className="field h-11 flex-1 font-mono text-[13px]"
            placeholder="Add by number, code or URL, e.g. 42"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn btn-primary h-11" disabled={!query.trim()}>
            <Plus size={16} aria-hidden /> Add problem
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Try</span>
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="chip chip-mono hover:border-border-strong hover:text-foreground" onClick={() => add(s)}>
              {s}
            </button>
          ))}
        </div>
        <p aria-live="polite" className="mt-3 min-h-[20px] text-[13px] text-muted-foreground">
          {message}
        </p>
      </div>

      {/* md+: table */}
      <div className="hidden md:block">
        <table className="table-paper w-full">
          <caption className="sr-only">Demo problem tracker</caption>
          <thead>
            <tr>
              <th scope="col" className="py-3 pl-5 pr-3">Problem</th>
              <th scope="col" className="px-3 py-3">Difficulty</th>
              <th scope="col" className="px-3 py-3">Topic</th>
              <th scope="col" className="px-3 py-3">
                Pattern <span className="chip chip-ember ml-1 h-5 px-1.5 text-[9.5px] normal-case tracking-normal">custom</span>
              </th>
              <th scope="col" className="px-3 py-3">Next review</th>
              <th scope="col" className="py-3 pl-3 pr-5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cn(fresh === r.id && 'animate-row-highlight')}>
                <td className="py-3 pl-5 pr-3">
                  <div className="text-[14px] font-medium text-foreground">{r.title}</div>
                  <div className="font-mono text-[11px] text-faint">
                    {r.platform} · {r.key}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className={cn('chip', difficultyChip(r.difficulty))}>{r.difficulty}</span>
                </td>
                <td className="px-3 py-3 text-[13.5px] text-muted-foreground">{r.topic}</td>
                <td className="px-3 py-3">
                  <EditableCell value={r.pattern} label={`Pattern for ${r.title}`} onSave={(v) => updatePattern(r.id, v)} />
                </td>
                <td className="px-3 py-3">
                  <div className={cn('text-[13.5px]', r.nextReview === 'Today' ? 'font-medium text-ember-strong' : 'text-foreground')}>
                    {r.nextReview}
                  </div>
                  <StepDots step={r.step} />
                </td>
                <td className="py-3 pl-3 pr-5 text-right">
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Delete ${r.title}`} onClick={() => remove(r.id)}>
                    <Trash2 size={14} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* < md: cards */}
      <ul className="divide-y divide-border md:hidden">
        {rows.map((r) => (
          <li key={r.id} className={cn('p-4', fresh === r.id && 'animate-row-highlight')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[15px] font-medium text-foreground">{r.title}</div>
                <div className="font-mono text-[11px] text-faint">
                  {r.platform} · {r.key} · {r.topic}
                </div>
              </div>
              <span className={cn('chip shrink-0', difficultyChip(r.difficulty))}>{r.difficulty}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="label mb-1">Pattern</span>
                <EditableCell value={r.pattern} label={`Pattern for ${r.title}`} onSave={(v) => updatePattern(r.id, v)} />
              </div>
              <div className="text-right">
                <div className={cn('text-[13px]', r.nextReview === 'Today' ? 'font-medium text-ember-strong' : 'text-foreground')}>
                  {r.nextReview}
                </div>
                <StepDots step={r.step} className="justify-end" />
              </div>
            </div>
          </li>
        ))}
        {rows.length === 0 ? <li className="p-6 text-center text-[14px] text-muted-foreground">No problems yet. Add one above.</li> : null}
      </ul>
      {rows.length === 0 ? (
        <p className="hidden p-8 text-center text-[14px] text-muted-foreground md:block">No problems yet. Add one above.</p>
      ) : null}
    </div>
  );
}

function StepDots({ step, className }: { step: number; className?: string }) {
  return (
    <div className={cn('mt-1 flex gap-1', className)} aria-label={`Step ${step + 1} of ${LADDER_DAYS.length}`} role="img">
      {LADDER_DAYS.map((d, i) => (
        <span key={d} className={cn('h-1 w-3 rounded-full', i <= step ? 'bg-ember' : 'bg-border')} />
      ))}
    </div>
  );
}

function EditableCell({ value, label, onSave }: { value: string; label: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="-mx-2 w-[calc(100%+16px)] max-w-[220px] truncate rounded-md px-2 py-1 text-left text-[13.5px] text-foreground transition-colors hover:bg-muted"
        aria-label={`${label}: ${value || 'empty'}. Edit`}
      >
        {value || <span className="text-faint">Add…</span>}
      </button>
    );
  }

  const commit = () => {
    onSave(draft.trim());
    setEditing(false);
  };

  return (
    <input
      autoFocus
      aria-label={label}
      className="field h-8 max-w-[220px] text-[13.5px]"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}
