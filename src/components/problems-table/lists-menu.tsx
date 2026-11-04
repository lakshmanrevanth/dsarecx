'use client';

import { useState } from 'react';
import { Check, ListChecks, ListPlus, Pencil, Trash2, X } from 'lucide-react';
import { DropdownMenu, MenuLabel, MenuSeparator, useMenuClose } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { failure } from './shared';

export type ProblemListSummary = { id: string; name: string; count: number; problemIds: string[] };

const iconBtn = 'inline-grid size-7 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-muted hover:text-foreground';

function NewListInput({ onCreate, placeholder = 'New list name…' }: { onCreate: (name: string) => Promise<unknown>; placeholder?: string }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await onCreate(name.trim());
      setName('');
    } catch (caught) {
      const e = failure(caught);
      setError(e?.message ?? 'Failed to create list');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="p-1"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          aria-label="New list name"
          maxLength={60}
          className="field h-8 min-w-0 flex-1 text-[13px]"
        />
        <button type="submit" disabled={!name.trim() || busy} aria-label="Create list" className="btn btn-primary btn-sm btn-icon h-8 w-8">
          <ListPlus size={14} aria-hidden />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-error">
          {error}
        </p>
      )}
    </form>
  );
}

function ListItem({
  list,
  onOpen,
  onRename,
  onDelete,
}: {
  list: ProblemListSummary;
  onOpen: () => void;
  onRename: (name: string) => Promise<unknown>;
  onDelete: () => void;
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm'>('view');
  const [name, setName] = useState(list.name);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim() || name.trim() === list.name) {
      setMode('view');
      return;
    }
    try {
      await onRename(name.trim());
      setMode('view');
      setError('');
    } catch (caught) {
      const e = failure(caught);
      setError(e?.message ?? 'Rename failed');
    }
  };

  if (mode === 'edit') {
    return (
      <div className="p-1">
        <div className="flex items-center gap-1">
          <input
            value={name}
            autoFocus
            maxLength={60}
            aria-label={`Rename list ${list.name}`}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                save();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setMode('view');
                setName(list.name);
              }
            }}
            className="field h-8 min-w-0 flex-1 text-[13px]"
          />
          <button type="button" onClick={save} aria-label="Save name" className={iconBtn}>
            <Check size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('view');
              setName(list.name);
            }}
            aria-label="Cancel rename"
            className={iconBtn}
          >
            <X size={14} aria-hidden />
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-1.5 text-xs text-error">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (mode === 'confirm') {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-lg bg-error-bg px-2.5 py-2 text-[13px]">
        <span className="min-w-0 flex-1 truncate">Delete “{list.name}”?</span>
        <button type="button" autoFocus onClick={onDelete} className="font-medium text-error hover:underline">
          Delete
        </button>
        <button type="button" onClick={() => setMode('view')} className="text-muted-foreground hover:text-foreground">
          Keep
        </button>
      </div>
    );
  }

  return (
    <div className="group/list flex items-center gap-0.5">
      <button type="button" data-menu-item="" tabIndex={-1} onClick={onOpen} className="menu-item min-w-0 flex-1">
        <ListChecks size={14} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{list.name}</span>
        <span className="font-mono text-[11px] text-faint">{list.count}</span>
      </button>
      <button type="button" onClick={() => setMode('edit')} aria-label={`Rename list ${list.name}`} title="Rename" className={iconBtn}>
        <Pencil size={13} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setMode('confirm')}
        aria-label={`Delete list ${list.name}`}
        title="Delete"
        className={cn(iconBtn, 'hover:bg-error-bg hover:text-error')}
      >
        <Trash2 size={13} aria-hidden />
      </button>
    </div>
  );
}

/** Tab-bar menu: open, create, rename and delete lists. */
export function ListsMenu({
  lists,
  onOpen,
  onCreate,
  onRename,
  onDelete,
}: {
  lists: ProblemListSummary[];
  onOpen: (id: string) => void;
  onCreate: (name: string) => Promise<unknown>;
  onRename: (id: string, name: string) => Promise<unknown>;
  onDelete: (id: string) => void;
}) {
  return (
    <DropdownMenu
      label="Lists"
      role="dialog"
      align="end"
      width={280}
      trigger={(p, { open }) => (
        <button {...p} className={cn('btn btn-ghost btn-sm gap-1.5', open && 'bg-muted text-foreground')}>
          <ListPlus size={14} aria-hidden />
          Lists
        </button>
      )}
    >
      {(close) => (
        <ListsPanel
          lists={lists}
          onOpen={(id) => {
            onOpen(id);
            close();
          }}
          onCreate={onCreate}
          onRename={onRename}
          onDelete={onDelete}
        />
      )}
    </DropdownMenu>
  );
}

function ListsPanel({
  lists,
  onOpen,
  onCreate,
  onRename,
  onDelete,
}: {
  lists: ProblemListSummary[];
  onOpen: (id: string) => void;
  onCreate: (name: string) => Promise<unknown>;
  onRename: (id: string, name: string) => Promise<unknown>;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <MenuLabel>Your lists</MenuLabel>
      {lists.length === 0 && (
        <p className="px-2.5 pb-2 pt-0.5 text-[13px] leading-relaxed text-muted-foreground">
          Group problems into lists like “Blind 75”. Each list gets its own tab.
        </p>
      )}
      {lists.map((l) => (
        <ListItem key={l.id} list={l} onOpen={() => onOpen(l.id)} onRename={(name) => onRename(l.id, name)} onDelete={() => onDelete(l.id)} />
      ))}
      <MenuSeparator />
      <NewListInput onCreate={onCreate} />
    </>
  );
}

/** Selection-bar menu: add the selected problems to a list, or to a new one. */
export function AddToListMenu({
  lists,
  onAdd,
  onCreateAndAdd,
  compact,
}: {
  lists: ProblemListSummary[];
  onAdd: (listId: string) => void;
  onCreateAndAdd: (name: string) => Promise<unknown>;
  compact?: boolean;
}) {
  return (
    <DropdownMenu
      label="Add to list"
      role="dialog"
      side="top"
      width={260}
      trigger={(p) => (
        <button {...p} aria-label="Add selected to list" className="btn btn-ghost btn-sm gap-1.5 text-foreground">
          <ListPlus size={14} aria-hidden />
          {!compact && <span>Add to list</span>}
        </button>
      )}
    >
      <AddToListPanel lists={lists} onAdd={onAdd} onCreateAndAdd={onCreateAndAdd} />
    </DropdownMenu>
  );
}

function AddToListPanel({ lists, onAdd, onCreateAndAdd }: { lists: ProblemListSummary[]; onAdd: (id: string) => void; onCreateAndAdd: (name: string) => Promise<unknown> }) {
  const close = useMenuClose();
  return (
    <>
      {lists.length > 0 && <MenuLabel>Add to</MenuLabel>}
      {lists.map((l) => (
        <button
          key={l.id}
          type="button"
          data-menu-item=""
          onClick={() => {
            onAdd(l.id);
            close();
          }}
          className="menu-item"
        >
          <ListChecks size={14} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{l.name}</span>
          <span className="font-mono text-[11px] text-faint">{l.count}</span>
        </button>
      ))}
      {lists.length > 0 && <MenuSeparator />}
      <NewListInput
        placeholder="Create a list and add…"
        onCreate={async (name) => {
          await onCreateAndAdd(name);
          close();
        }}
      />
    </>
  );
}
