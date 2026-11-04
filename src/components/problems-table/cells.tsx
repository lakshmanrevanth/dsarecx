'use client';

// Click-to-edit table cells: difficulty and topic pickers, a notes popover editor
// and the bookmark toggle. Each saves on its own (autosave); the parent's handler
// updates the SWR cache optimistically and toasts on failure.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Bookmark, Plus } from 'lucide-react';
import { DropdownMenu, MenuItem, MenuLabel, MenuRadioItem, Popover, type CloseReason } from '@/components/ui/dropdown-menu';
import { TopicPill } from '@/components/ui/pill';
import { cn } from '@/lib/utils';
import { DEFAULT_TOPICS, DIFFICULTIES, DifficultyChip, cap } from './shared';
import { mergeSuggestions, topicsFrom, useCachedProblems } from './suggestions';

const trigger = 'inline-flex max-w-full cursor-pointer items-center rounded-full transition-opacity disabled:cursor-default';

async function run(fn: () => Promise<void> | void, setSaving: (v: boolean) => void) {
  setSaving(true);
  try {
    await fn();
  } catch {
    // The parent reverts the cache and shows a toast.
  } finally {
    setSaving(false);
  }
}

export function DifficultyPickerCell({
  difficulty,
  onSave,
  placeholder = 'Set',
}: {
  difficulty: string;
  onSave: (val: string) => Promise<void> | void;
  placeholder?: string;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <DropdownMenu
      label="Difficulty"
      width={150}
      trigger={(props) => (
        <button
          {...props}
          data-difficulty-pill
          aria-label={difficulty ? `Difficulty: ${cap(difficulty)}. Change difficulty` : 'Set difficulty'}
          className={cn(trigger, saving && 'opacity-60')}
          onClick={(e) => {
            e.stopPropagation();
            props.onClick();
          }}
        >
          <DifficultyChip difficulty={difficulty} placeholder={placeholder} className="hover:brightness-95" />
        </button>
      )}
    >
      {DIFFICULTIES.map((d) => (
        <MenuRadioItem
          key={d}
          checked={d === difficulty}
          onSelect={() => d !== difficulty && run(() => onSave(d), setSaving)}
        >
          <DifficultyChip difficulty={d} />
        </MenuRadioItem>
      ))}
    </DropdownMenu>
  );
}

export function TopicPickerCell({
  topic,
  onSave,
  suggestions,
}: {
  topic: string;
  onSave: (val: string) => Promise<void> | void;
  /** The user's own topics; derived from the cached problem list when omitted. */
  suggestions?: string[];
}) {
  const [saving, setSaving] = useState(false);
  const select = (t: string) => {
    if (t !== topic) run(() => onSave(t), setSaving);
  };
  return (
    <DropdownMenu
      label="Topic"
      width={240}
      trigger={(props) => (
        <button
          {...props}
          data-topic-pill
          aria-label={topic ? `Topic: ${topic}. Change topic` : 'Set topic'}
          className={cn(trigger, 'min-w-0', saving && 'opacity-60')}
          onClick={(e) => {
            e.stopPropagation();
            props.onClick();
          }}
        >
          {topic ? (
            <TopicPill topic={topic} className="hover:brightness-95" />
          ) : (
            <span className="chip border-dashed text-faint">Topic</span>
          )}
        </button>
      )}
    >
      {(close) => <TopicOptions topic={topic} suggestions={suggestions} onSelect={(t) => { select(t); close(); }} />}
    </DropdownMenu>
  );
}

// Mounted only while open, so the cache read is short-lived.
function TopicOptions({ topic, suggestions, onSelect }: { topic: string; suggestions?: string[]; onSelect: (t: string) => void }) {
  const [q, setQ] = useState('');
  const cached = useCachedProblems();
  const all = mergeSuggestions(suggestions ?? topicsFrom(cached), DEFAULT_TOPICS);
  const query = q.trim().toLowerCase();
  const shown = all.filter((t) => t.toLowerCase().includes(query));
  const exact = all.find((t) => t.toLowerCase() === query);
  const canCreate = query.length > 0 && !exact && topic.toLowerCase() !== query;
  return (
    <div className="flex flex-col">
      <input
        data-autofocus
        className="field mb-1.5 h-8 text-[13px]"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q.trim()) {
            e.preventDefault();
            // Reuse an existing spelling ("dp" → "DP") so topics don't fragment.
            onSelect(exact ?? q.trim());
          }
        }}
        placeholder="Search or add a topic…"
        aria-label="Search or add a topic"
        maxLength={60}
      />
      {canCreate && (
        <MenuItem icon={<Plus />} onSelect={() => onSelect(q.trim())} className="text-ember-strong">
          Create “{q.trim()}”
        </MenuItem>
      )}
      {!canCreate && shown.length === 0 && <p className="px-2.5 py-2 text-xs text-faint">No matching topics</p>}
      {shown.length > 0 && <MenuLabel>{query ? 'Matches' : 'Topics'}</MenuLabel>}
      {shown.map((t) => (
        <MenuRadioItem key={t} checked={t === topic} onSelect={() => onSelect(t)} keepOpen>
          <TopicPill topic={t} />
        </MenuRadioItem>
      ))}
    </div>
  );
}

/**
 * Text cell (notes) that opens a small editor over itself.
 * Enter saves, Shift+Enter adds a line, Esc cancels, clicking away saves.
 */
export function InlineTextCell({
  value,
  label,
  placeholder,
  onSave,
  maxLength = 5000,
}: {
  value: string;
  label: string;
  placeholder?: string;
  onSave: (val: string) => Promise<void> | void;
  maxLength?: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const text = value.trim();

  useEffect(() => {
    if (!open) return;
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [open, draft]);

  const commit = async () => {
    setOpen(false);
    const next = draft.trim();
    if (next === text) return;
    await run(() => onSave(next), setSaving);
  };
  const onClose = (reason: CloseReason) => {
    if (reason === 'escape') {
      setDraft(value);
      setOpen(false);
    } else commit();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
      anchorRef.current?.focus();
    }
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={text ? `${label}: ${text}. Edit` : `Add ${label.toLowerCase()}`}
        title={text || undefined}
        onClick={(e) => {
          e.stopPropagation();
          setDraft(value);
          setOpen(true);
        }}
        className={cn(
          'group/cell flex h-8 w-full min-w-0 items-center rounded-md px-2 text-left text-[13px] transition-colors hover:bg-muted/70',
          text ? 'text-muted-foreground' : 'text-faint',
          saving && 'opacity-60'
        )}
      >
        <span className="min-w-0 flex-1 truncate">{text || <span className="opacity-0 group-hover/cell:opacity-100">{placeholder ?? 'Add…'}</span>}</span>
      </button>
      <Popover open={open} onClose={onClose} anchorRef={anchorRef} label={label} width={300} className="p-2">
        <textarea
          ref={areaRef}
          data-autofocus
          value={draft}
          maxLength={maxLength}
          rows={2}
          aria-label={label}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
          className="block w-full resize-none bg-transparent px-1.5 py-1 text-[13px] leading-relaxed text-foreground outline-none placeholder:text-faint"
        />
        <div className="mt-1 flex items-center justify-between border-t border-border px-1.5 pt-1.5 text-[11px] text-faint">
          <span>
            <kbd className="kbd">Enter</kbd> save · <kbd className="kbd">Esc</kbd> cancel
          </span>
          <span className="font-mono">⇧↵ new line</span>
        </div>
      </Popover>
    </>
  );
}

export function StarButton({ on, onToggle, className, size = 15 }: { on: boolean; onToggle: () => void; className?: string; size?: number }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={on ? 'Remove bookmark' : 'Bookmark'}
      aria-pressed={on}
      title={on ? 'Remove bookmark' : 'Bookmark'}
      className={cn(
        'inline-grid size-8 place-items-center rounded-full transition-colors hover:bg-muted',
        on ? 'text-ember' : 'text-faint hover:text-foreground',
        className
      )}
    >
      <Bookmark size={size} strokeWidth={1.75} fill={on ? 'currentColor' : 'none'} aria-hidden />
    </button>
  );
}
