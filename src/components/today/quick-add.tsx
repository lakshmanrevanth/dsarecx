'use client';

// One line to add something to the to-learn list: DSA / System design toggle,
// a text field (title, problem number or pasted link), an optional target date.

import { useId, useRef, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { CONCEPTS } from '@/lib/concepts/library';
import { CODING_PLATFORMS, PLATFORM_LABELS, STUDY_LIMITS, type CodingPlatform, type StudyKind } from '@/lib/study';
import { cn } from '@/lib/utils';
import { buildQuickAdd } from './learn';

export function KindToggle({
  value,
  onChange,
  label,
  className,
}: {
  value: StudyKind;
  onChange: (k: StudyKind) => void;
  label: string;
  className?: string;
}) {
  const options: { value: StudyKind; label: string }[] = [
    { value: 'DSA', label: 'DSA' },
    { value: 'SYSTEM_DESIGN', label: 'System design' },
  ];
  return (
    <div role="group" aria-label={label} className={cn('inline-flex rounded-full border border-border bg-card p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-7 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition-colors duration-150',
            value === o.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function QuickAdd({
  today,
  defaultPlatform,
  onAdd,
}: {
  today: string;
  defaultPlatform: CodingPlatform;
  /** Saves the item; resolves false when it failed (the text is kept). */
  onAdd: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [kind, setKind] = useState<StudyKind>('DSA');
  const [platform, setPlatform] = useState<CodingPlatform | null>(null);
  const [text, setText] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ids = { text: useId(), date: useId(), platform: useId(), hint: useId(), list: useId() };
  const chosenPlatform = platform ?? defaultPlatform;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const body = await buildQuickAdd(kind, text, { platform: chosenPlatform, targetDate: targetDate || null });
      if (await onAdd(body)) {
        setText('');
        setTargetDate('');
      }
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <form onSubmit={submit} className="card p-3 sm:p-4" aria-label="Add to your to-learn list">
      <div className="flex flex-wrap items-center gap-2">
        <KindToggle value={kind} onChange={setKind} label="What kind of item" />
        {kind === 'DSA' && (
          <>
            <label htmlFor={ids.platform} className="sr-only">
              Platform
            </label>
            <select
              id={ids.platform}
              value={chosenPlatform}
              onChange={(e) => setPlatform(e.target.value as CodingPlatform)}
              className="field h-9 w-auto min-w-0 py-0 text-[13px]"
            >
              {CODING_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <label htmlFor={ids.text} className="sr-only">
          {kind === 'DSA' ? 'Problem title, number or link' : 'Concept to learn'}
        </label>
        <input
          ref={inputRef}
          id={ids.text}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={STUDY_LIMITS.url}
          autoComplete="off"
          list={kind === 'SYSTEM_DESIGN' ? ids.list : undefined}
          aria-describedby={ids.hint}
          placeholder={kind === 'DSA' ? 'e.g. 146, LRU Cache, or paste a problem link' : 'e.g. Consistent hashing, rate limiter'}
          className="field min-w-0 flex-[1_1_16rem]"
        />
        <label htmlFor={ids.date} className="sr-only">
          Target date (optional)
        </label>
        <input
          id={ids.date}
          type="date"
          value={targetDate}
          min={today}
          onChange={(e) => setTargetDate(e.target.value)}
          title="Target date (optional)"
          className="field w-auto min-w-0 flex-[1_1_9rem] font-mono text-[13px] sm:flex-none"
        />
        <button type="submit" className="btn btn-primary h-10 flex-none" disabled={!text.trim() || busy}>
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Plus size={16} strokeWidth={1.75} aria-hidden />}
          Add
        </button>
      </div>
      <p id={ids.hint} className="mt-2 px-1 text-[12.5px] text-muted-foreground">
        {kind === 'DSA'
          ? 'Press Enter to add. A number or link fills in the title for you. Target date is optional.'
          : 'Press Enter to add. Pick a suggestion to match a concept from the library.'}
      </p>
      {kind === 'SYSTEM_DESIGN' && (
        <datalist id={ids.list}>
          {CONCEPTS.map((c) => (
            <option key={c.slug} value={c.title} />
          ))}
        </datalist>
      )}
    </form>
  );
}
