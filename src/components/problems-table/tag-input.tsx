'use client';

import { useId, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Popover, type CloseReason } from '@/components/ui/dropdown-menu';
import { MAX_TAGS, MAX_TAG_LENGTH, normalizeTags } from '@/lib/platforms/problem-input';
import { cn } from '@/lib/utils';
import { REVEAL, TagChip } from './shared';
import { tagsFrom, useCachedProblems } from './suggestions';

export { TagChip };

/**
 * Chip editor: Enter or comma adds, Backspace on an empty input removes the last tag.
 * Enter on an empty input calls onSubmit (e.g. save the whole form).
 */
export function TagEditor({
  tags,
  onChange,
  suggestions,
  autoFocus,
  onSubmit,
  onEscape,
  placeholder = 'Add tag…',
  id,
  className,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  autoFocus?: boolean;
  onSubmit?: () => void;
  onEscape?: () => void;
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const listId = useId();
  const cached = useCachedProblems();
  const options = (suggestions ?? tagsFrom(cached)).filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()));

  const add = (raw: string) => {
    if (!raw.trim()) return;
    const result = normalizeTags([...tags, raw]);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setError('');
    onChange(result.tags);
    setText('');
  };

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <div className="field flex h-auto min-h-10 flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-ember focus-within:shadow-[0_0_0_3px_var(--ember-soft)]">
        {tags.map((t) => (
          <TagChip key={t} tag={t} onRemove={() => onChange(tags.filter((x) => x !== t))} />
        ))}
        {tags.length < MAX_TAGS && (
          <input
            id={id}
            data-autofocus={autoFocus ? '' : undefined}
            value={text}
            list={listId}
            autoFocus={autoFocus}
            maxLength={MAX_TAG_LENGTH}
            aria-label="Add tag"
            aria-invalid={!!error}
            placeholder={tags.length ? '' : placeholder}
            onChange={(e) => {
              const v = e.target.value;
              if (v.endsWith(',')) add(v.slice(0, -1));
              else {
                setText(v);
                setError('');
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (text.trim()) add(text);
                else onSubmit?.();
              } else if (e.key === 'Backspace' && !text && tags.length) {
                onChange(tags.slice(0, -1));
              } else if (e.key === 'Escape' && onEscape) {
                e.preventDefault();
                e.stopPropagation();
                onEscape();
              }
            }}
            onBlur={() => add(text)}
            className="h-6 min-w-[80px] flex-1 bg-transparent px-1 text-[13px] text-foreground outline-none placeholder:text-faint"
          />
        )}
        <datalist id={listId}>
          {options.slice(0, 50).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      {error && (
        <span role="alert" className="text-xs text-error">
          {error}
        </span>
      )}
    </div>
  );
}

/** Compact tags in a table cell; opens the chip editor in a popover. Saves on close. */
export function TagsCell({ tags, onSave, suggestions }: { tags: string[]; onSave: (tags: string[]) => Promise<void> | void; suggestions?: string[] }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(tags);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const save = async (next: string[]) => {
    setOpen(false);
    if (next.join('\u0000') === tags.join('\u0000')) return;
    try {
      await onSave(next);
    } catch {
      /* parent reverts and toasts */
    }
  };
  const onClose = (reason: CloseReason) => {
    if (reason === 'escape') setOpen(false);
    else save(draft);
  };

  const shown = tags.slice(0, 1);
  const extra = tags.length - shown.length;
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        data-tags-cell
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={tags.length ? `Tags: ${tags.join(', ')}. Edit tags` : 'Add tags'}
        title={tags.length ? tags.join(', ') : 'Add tags'}
        onClick={(e) => {
          e.stopPropagation();
          setDraft(tags);
          setOpen(true);
        }}
        className={cn('inline-flex min-w-0 shrink items-center gap-1 rounded-full', !tags.length && REVEAL)}
      >
        {shown.map((t) => (
          <TagChip key={t} tag={t} className="max-w-[96px]" />
        ))}
        {extra > 0 && <span className="chip h-[22px] px-1.5 font-mono text-[11px]">+{extra}</span>}
        {tags.length === 0 && (
          <span className="chip h-[22px] gap-1 border-dashed bg-transparent px-2 text-[11px] text-faint">
            <Plus size={10} aria-hidden /> tag
          </span>
        )}
      </button>
      <Popover open={open} onClose={onClose} anchorRef={anchorRef} label="Tags" width={280} className="p-3">
        <TagEditor
          tags={draft}
          onChange={setDraft}
          suggestions={suggestions}
          autoFocus
          onSubmit={() => {
            save(draft);
            anchorRef.current?.focus();
          }}
          onEscape={() => {
            setOpen(false);
            anchorRef.current?.focus();
          }}
        />
        <p className="mt-2 text-[11px] text-faint">
          <kbd className="kbd">Enter</kbd> add · <kbd className="kbd">Enter</kbd> on empty saves · <kbd className="kbd">Esc</kbd> cancel
        </p>
      </Popover>
    </>
  );
}
