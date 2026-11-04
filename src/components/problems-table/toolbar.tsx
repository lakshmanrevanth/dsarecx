'use client';

import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, Layers, Search, SlidersHorizontal, X } from 'lucide-react';
import { DropdownMenu, MenuCheckboxItem, MenuLabel, MenuRadioItem, MenuSeparator } from '@/components/ui/dropdown-menu';
import { PlatformLogo } from '@/lib/platforms/logos';
import { cn } from '@/lib/utils';
import { DIFFICULTY_KEYS, PLATFORM_KEYS, STATUS_KEYS, type DueFilter, type GroupBy, type TableState } from './filters';
import { PLATFORM_LABELS, cap } from './shared';

export type { SortOrder } from './filters';

type ToolbarProps = {
  state: TableState;
  onChange: (patch: Partial<TableState>) => void;
  topicOptions: { value: string; count: number }[];
  lists: { id: string; name: string }[];
  /** Rendered at the end of the row (e.g. result count). */
  trailing?: ReactNode;
};

const SORT_OPTIONS = [
  { value: 'dateAdded', label: 'Date added' },
  { value: 'nextRevision', label: 'Next review' },
  { value: 'problemNumber', label: 'Number' },
  { value: 'difficulty', label: 'Difficulty' },
  { value: 'status', label: 'Status' },
  { value: 'topic', label: 'Topic' },
];

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'none', label: 'No grouping' },
  { value: 'status', label: 'Status' },
  { value: 'topic', label: 'Topic' },
];

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function FilterButton({ label, count, active, icon, className, ...props }: { label: string; count?: number; active?: boolean; icon?: ReactNode } & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      {...props}
      className={cn(
        'btn btn-sm gap-1.5 border px-3 font-normal',
        active ? 'border-ember/40 bg-ember-soft text-ember-strong' : 'btn-outline text-muted-foreground hover:text-foreground',
        className
      )}
    >
      {icon}
      <span>{label}</span>
      {!!count && <span className="font-mono text-[11px] tabular-nums">{count}</span>}
      <ChevronDown size={13} aria-hidden className="opacity-60" />
    </button>
  );
}

function TopicPicker({ options, selected, onToggle }: { options: { value: string; count: number }[]; selected: string[]; onToggle: (v: string) => void }) {
  const [q, setQ] = useState('');
  const sel = new Set(selected.map((s) => s.toLowerCase()));
  const shown = options.filter((o) => o.value.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <input
        data-autofocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find a topic or tag…"
        aria-label="Find a topic or tag"
        className="field mb-1.5 h-8 text-[13px]"
      />
      {shown.length === 0 && <p className="px-2.5 py-2 text-xs text-faint">No topics yet</p>}
      {shown.map((o) => (
        <MenuCheckboxItem key={o.value} checked={sel.has(o.value.toLowerCase())} onCheckedChange={() => onToggle(o.value)} hint={o.count}>
          {o.value}
        </MenuCheckboxItem>
      ))}
    </>
  );
}

export function Toolbar({ state, onChange, topicOptions, lists, trailing }: ToolbarProps) {
  const { q: search, platforms, difficulties, statuses, topics, due, sort, order, group } = state;

  // Local search value, debounced up; outside resets ("Clear filters") flow back down.
  const [value, setValue] = useState(search);
  const lastEmitted = useRef(search);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (search !== lastEmitted.current) {
      lastEmitted.current = search;
      setValue(search);
    }
  }, [search]);
  const onSearch = (v: string) => {
    setValue(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      lastEmitted.current = v;
      onChange({ q: v });
    }, 150);
  };

  // "/" or Ctrl/⌘+K focuses search.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      const el = document.activeElement as HTMLElement | null;
      const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT' || el?.isContentEditable;
      if (cmdK || (e.key === '/' && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const listName = (id: string) => lists.find((l) => l.id === id)?.name ?? 'Unknown list';
  const chips = [
    ...platforms.map((p) => ({ key: `p-${p}`, label: PLATFORM_LABELS[p] ?? p, remove: () => onChange({ platforms: toggle(platforms, p) }) })),
    ...topics.map((t) => ({ key: `t-${t}`, label: `#${t}`, remove: () => onChange({ topics: topics.filter((x) => x !== t) }) })),
    ...difficulties.map((d) => ({ key: `d-${d}`, label: cap(d), remove: () => onChange({ difficulties: toggle(difficulties, d) }) })),
    ...statuses.map((s) => ({ key: `s-${s}`, label: cap(s), remove: () => onChange({ statuses: toggle(statuses, s) }) })),
    ...state.lists.map((l) => ({ key: `l-${l}`, label: `List · ${listName(l)}`, remove: () => onChange({ lists: toggle(state.lists, l) }) })),
  ];
  const otherCount = difficulties.length + statuses.length + state.lists.length;

  const quick = (v: Exclude<DueFilter, ''>, label: string) => {
    const on = due === v;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => onChange({ due: on ? '' : v })}
        className={cn(
          'btn btn-sm border px-3 font-normal',
          on ? 'border-ember/40 bg-ember-soft text-ember-strong' : 'btn-outline text-muted-foreground hover:text-foreground'
        )}
      >
        {on && <span aria-hidden className="size-1.5 rounded-full bg-ember" />}
        {label}
      </button>
    );
  };

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Sort';
  const toggleTopic = (t: string) => {
    const lower = t.toLowerCase();
    const has = topics.some((x) => x.toLowerCase() === lower);
    onChange({ topics: has ? topics.filter((x) => x.toLowerCase() !== lower) : [...topics, t] });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[260px]">
          <Search size={15} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && value) {
                e.preventDefault();
                e.stopPropagation();
                onSearch('');
              }
            }}
            placeholder="Search problems"
            aria-label="Search problems by title, number, code, topic, tag or notes"
            className="field h-[34px] rounded-full pl-10 pr-10 text-[13.5px] [&::-webkit-search-cancel-button]:hidden"
          />
          {value ? (
            <button
              type="button"
              onClick={() => {
                onSearch('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 inline-grid size-6 -translate-y-1/2 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground"
            >
              <X size={13} aria-hidden />
            </button>
          ) : (
            <kbd aria-hidden className="kbd pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              /
            </kbd>
          )}
        </div>

        <DropdownMenu
          label="Filter by platform"
          width={220}
          trigger={(p) => <FilterButton {...p} label="Platform" count={platforms.length} active={platforms.length > 0} />}
        >
          {PLATFORM_KEYS.map((p) => (
            <MenuCheckboxItem
              key={p}
              checked={platforms.includes(p)}
              onCheckedChange={() => onChange({ platforms: toggle(platforms, p) })}
              icon={<PlatformLogo platform={p} size={16} />}
            >
              {PLATFORM_LABELS[p]}
            </MenuCheckboxItem>
          ))}
        </DropdownMenu>

        <DropdownMenu
          label="Filter by topic or tag"
          width={240}
          trigger={(p) => <FilterButton {...p} label="Topic" count={topics.length} active={topics.length > 0} />}
        >
          <TopicPicker options={topicOptions} selected={topics} onToggle={toggleTopic} />
        </DropdownMenu>

        {quick('overdue', 'Overdue')}
        {quick('week', 'Due this week')}

        <DropdownMenu
          label="More filters"
          width={220}
          trigger={(p) => (
            <FilterButton {...p} label="Filters" icon={<SlidersHorizontal size={13} aria-hidden />} count={otherCount} active={otherCount > 0} />
          )}
        >
          <MenuLabel>Difficulty</MenuLabel>
          {DIFFICULTY_KEYS.map((d) => (
            <MenuCheckboxItem key={d} checked={difficulties.includes(d)} onCheckedChange={() => onChange({ difficulties: toggle(difficulties, d) })}>
              {cap(d)}
            </MenuCheckboxItem>
          ))}
          <MenuSeparator />
          <MenuLabel>Status</MenuLabel>
          {STATUS_KEYS.map((s) => (
            <MenuCheckboxItem key={s} checked={statuses.includes(s)} onCheckedChange={() => onChange({ statuses: toggle(statuses, s) })}>
              {cap(s)}
            </MenuCheckboxItem>
          ))}
          {lists.length > 0 && (
            <>
              <MenuSeparator />
              <MenuLabel>List</MenuLabel>
              {lists.map((l) => (
                <MenuCheckboxItem key={l.id} checked={state.lists.includes(l.id)} onCheckedChange={() => onChange({ lists: toggle(state.lists, l.id) })}>
                  {l.name}
                </MenuCheckboxItem>
              ))}
            </>
          )}
        </DropdownMenu>

        <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />

        <DropdownMenu
          label="Group rows"
          width={170}
          trigger={(p) => (
            <FilterButton
              {...p}
              label={group === 'none' ? 'Group' : `Group · ${GROUP_OPTIONS.find((g) => g.value === group)?.label}`}
              icon={<Layers size={13} aria-hidden />}
              active={group !== 'none'}
            />
          )}
        >
          {GROUP_OPTIONS.map((g) => (
            <MenuRadioItem key={g.value} checked={group === g.value} onSelect={() => onChange({ group: g.value })}>
              {g.label}
            </MenuRadioItem>
          ))}
        </DropdownMenu>

        <div className="inline-flex items-center">
          <DropdownMenu label="Sort by" width={180} trigger={(p) => <FilterButton {...p} label={`Sort · ${sortLabel}`} className="rounded-r-none" />}>
            {SORT_OPTIONS.map((o) => (
              <MenuRadioItem key={o.value} checked={sort === o.value} onSelect={() => onChange({ sort: o.value })}>
                {o.label}
              </MenuRadioItem>
            ))}
          </DropdownMenu>
          <button
            type="button"
            onClick={() => onChange({ order: order === 'asc' ? 'desc' : 'asc' })}
            aria-label={order === 'asc' ? 'Ascending. Switch to descending' : 'Descending. Switch to ascending'}
            title={order === 'asc' ? 'Ascending' : 'Descending'}
            className="btn btn-outline btn-sm btn-icon -ml-px w-8 rounded-l-none text-muted-foreground hover:text-foreground"
          >
            {order === 'asc' ? <ArrowUpNarrowWide size={14} aria-hidden /> : <ArrowDownWideNarrow size={14} aria-hidden />}
          </button>
        </div>

        {trailing && <div className="ml-auto">{trailing}</div>}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Filtered by</span>
          {chips.map((f) => (
            <span key={f.key} className="chip h-[26px] gap-1 pr-1">
              {f.label}
              <button
                type="button"
                onClick={f.remove}
                aria-label={`Remove filter ${f.label}`}
                className="inline-grid size-5 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground"
              >
                <X size={11} aria-hidden />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange({ platforms: [], topics: [], difficulties: [], statuses: [], lists: [] })}
            className="ml-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
