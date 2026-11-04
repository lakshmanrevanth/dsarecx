'use client';

import { useEffect, useRef } from 'react';

export const TABLE_SHORTCUTS: [string[], string][] = [
  [['j'], 'Next problem'],
  [['k'], 'Previous problem'],
  [['Enter'], 'Recall first: open notes panel'],
  [['1'], 'Rate Clean'],
  [['2'], 'Rate Shaky'],
  [['3'], 'Rate Struggled'],
  [['u'], 'Undo the last rating'],
  [['Ctrl', 'Z'], 'Undo the last rating (⌘Z on Mac)'],
  [['f'], 'Focus mode'],
  [['?'], 'Show or hide this list'],
];

export const FOCUS_SHORTCUTS: [string[], string][] = [
  [['Space'], 'Reveal notes'],
  [['1', '2', '3'], 'Rate Clean / Shaky / Struggled'],
  [['s'], 'Snooze to tomorrow'],
  [['u'], 'Undo the last rating'],
  [['Esc'], 'Exit focus mode'],
];

type ShortcutsHelpProps = { id: string; onClose: () => void };

/** Non-modal popover listing keyboard shortcuts. Esc, ? or clicking outside closes it. */
export function ShortcutsHelp({ id, onClose }: ShortcutsHelpProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (ref.current && !ref.current.contains(el) && !el.closest?.('[data-shortcuts-toggle]')) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const section = (title: string, rows: [string[], string][]) => (
    <div>
      <p className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">{title}</p>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
        {rows.map(([keys, label]) => (
          <div key={label} className="contents">
            <dt className="flex gap-1">
              {keys.map((k) => (
                <kbd key={k} className="kbd">
                  {k}
                </kbd>
              ))}
            </dt>
            <dd className="text-[13px] text-foreground">{label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  return (
    <div
      id={id}
      ref={ref}
      role="dialog"
      aria-label="Keyboard shortcuts"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === '?') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      className="menu absolute right-0 top-[calc(100%+8px)] z-50 flex w-[min(320px,calc(100vw-32px))] flex-col gap-5 p-4 outline-none"
    >
      {section('Daily list', TABLE_SHORTCUTS)}
      <div className="menu-sep" />
      {section('Focus mode', FOCUS_SHORTCUTS)}
    </div>
  );
}
