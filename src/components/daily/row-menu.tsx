'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RowMenuItem = {
  key: string;
  label: string;
  onSelect?: () => void;
  /** Renders a link (opens in a new tab) instead of a button. */
  href?: string;
  icon?: React.ReactNode;
  danger?: boolean;
  separatorBefore?: boolean;
};

type RowMenuProps = {
  items: RowMenuItem[];
  label: string;
  disabled?: boolean;
  className?: string;
};

/** "⋯" menu button: aria-haspopup menu, arrow keys / Home / End, Esc closes and refocuses the button. */
export function RowMenu({ items, label, disabled, className }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const moveFocus = (delta: number | 'first' | 'last') => {
    const els = itemRefs.current.slice(0, items.length).filter((el): el is HTMLElement => !!el?.isConnected);
    if (els.length === 0) return;
    const i = els.indexOf(document.activeElement as HTMLElement);
    const next = delta === 'first' ? 0 : delta === 'last' ? els.length - 1 : (i + delta + els.length) % els.length;
    els[next].focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    // Keep row and page shortcuts from firing while the menu is open.
    e.stopPropagation();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      moveFocus('first');
    } else if (e.key === 'End') {
      e.preventDefault();
      moveFocus('last');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={wrapRef} className={cn('relative inline-flex', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }
        }}
        className={cn('btn btn-ghost btn-icon', open && 'bg-muted text-foreground')}
      >
        <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="menu absolute right-0 top-[calc(100%+6px)] z-50"
        >
          {items.map((item, i) => (
            <div key={item.key} role="none">
              {item.separatorBefore && <div role="separator" className="menu-sep" />}
              {item.href ? (
                <a
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  role="menuitem"
                  tabIndex={-1}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => close(false)}
                  className="menu-item"
                  data-danger={item.danger || undefined}
                >
                  {item.icon}
                  {item.label}
                </a>
              ) : (
                <button
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    close(true);
                    item.onSelect?.();
                  }}
                  className="menu-item"
                  data-danger={item.danger || undefined}
                >
                  {item.icon}
                  {item.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
