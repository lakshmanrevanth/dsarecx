'use client';

// Accessible popovers and dropdown menus without a headless UI dependency.
//
// <Popover>       anchored, portalled panel: outside click / Escape close it, focus
//                 moves in on open and back to the anchor on Escape, it flips above
//                 the anchor when there is no room below and follows scrolling.
// <DropdownMenu>  a trigger + Popover with role="menu" and arrow-key navigation over
//                 its items (MenuItem, MenuCheckboxItem, MenuRadioItem).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PopoverAlign = 'start' | 'end';
export type PopoverSide = 'bottom' | 'top';
export type CloseReason = 'escape' | 'outside' | 'select' | 'tab' | 'scroll';

const ITEM_SELECTOR = '[data-menu-item]:not([disabled]):not([aria-disabled="true"])';
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type PopoverProps = {
  open: boolean;
  onClose: (reason: CloseReason) => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  align?: PopoverAlign;
  side?: PopoverSide;
  /** Fixed width in px; 'anchor' matches the anchor's width (as a minimum). */
  width?: number | 'anchor';
  role?: 'menu' | 'dialog' | 'listbox';
  /** Accessible name for the panel. */
  label?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
  /** Move focus into the panel on open (to [data-autofocus], else the first item). Default true. */
  autoFocus?: boolean;
  /** Keyboard navigation over [data-menu-item] with arrows/Home/End. Default: on for menu/listbox. */
  arrowNav?: boolean;
};

export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  align = 'start',
  side = 'bottom',
  width,
  role = 'dialog',
  label,
  id,
  className,
  style,
  autoFocus = true,
  arrowNav,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; minWidth?: number } | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const navigable = arrowNav ?? role !== 'dialog';

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const r = anchor.getBoundingClientRect();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = vh - r.bottom - 8;
    const above = r.top - 8;
    const up = side === 'top' ? above >= h || above > below : below < h && above > below;
    let top = up ? r.top - h - 6 : r.bottom + 6;
    top = Math.max(8, Math.min(top, vh - h - 8));
    let left = align === 'end' ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, vw - w - 8));
    const minWidth = width === 'anchor' ? r.width : undefined;
    setPos((p) => (p && p.top === top && p.left === left && p.minWidth === minWidth ? p : { top, left, minWidth }));
  }, [anchorRef, align, side, width]);

  // Place before paint, then follow scroll / resize / content size changes.
  useIsoLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) {
        onCloseRef.current('scroll');
        return;
      }
      place();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => place()) : null;
    if (panelRef.current) ro?.observe(panelRef.current);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
      ro?.disconnect();
    };
  }, [open, place, anchorRef]);

  // Focus in once placed.
  const placed = pos !== null;
  useEffect(() => {
    if (!open || !placed || !autoFocus) return;
    const panel = panelRef.current;
    if (!panel || panel.contains(document.activeElement)) return;
    const target =
      panel.querySelector<HTMLElement>('[data-autofocus]') ??
      panel.querySelector<HTMLElement>('[data-menu-item][aria-checked="true"]') ??
      panel.querySelector<HTMLElement>(navigable ? ITEM_SELECTOR : FOCUSABLE) ??
      panel;
    target.focus({ preventScroll: true });
  }, [open, placed, autoFocus, navigable]);

  // Outside pointer closes. Clicks inside any other popover (nested pickers) don't.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t) return;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      if (t.closest?.('[data-popover]')) return;
      onCloseRef.current('outside');
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open, anchorRef]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCloseRef.current('escape');
      anchorRef.current?.focus();
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    if (e.key === 'Tab') {
      if (role !== 'dialog') {
        e.preventDefault();
        onCloseRef.current('tab');
        anchorRef.current?.focus();
        return;
      }
      // Dialog popovers keep Tab inside.
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (!navigable) return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const active = document.activeElement as HTMLElement | null;
    // From a search box, ArrowDown moves into the list; other inputs keep their arrow keys.
    if (active?.tagName === 'TEXTAREA' || active?.tagName === 'SELECT') return;
    if (active?.tagName === 'INPUT') {
      const t = (active as HTMLInputElement).type;
      if (!(t === 'text' || t === 'search') || e.key !== 'ArrowDown') return;
    }
    const items = Array.from(panel.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
    if (!items.length) return;
    e.preventDefault();
    const i = active ? items.indexOf(active) : -1;
    let next = 0;
    if (e.key === 'ArrowDown') next = i < 0 ? 0 : (i + 1) % items.length;
    else if (e.key === 'ArrowUp') next = i <= 0 ? items.length - 1 : i - 1;
    else if (e.key === 'End') next = items.length - 1;
    items[next].focus();
  };

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={panelRef}
      id={id}
      data-popover=""
      role={role}
      aria-label={label}
      aria-modal={role === 'dialog' ? false : undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn(
        'menu fixed z-[95] overflow-y-auto outline-none',
        pos ? 'animate-in fade-in-0 zoom-in-95 duration-150' : 'pointer-events-none opacity-0',
        className
      )}
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: typeof width === 'number' ? width : undefined,
        minWidth: pos?.minWidth,
        maxHeight: 'min(440px, calc(100vh - 16px))',
        ...style,
      }}
    >
      {children}
    </div>,
    document.body
  );
}

// ───────── Dropdown menu ─────────

type MenuCtx = { close: () => void };
const MenuContext = createContext<MenuCtx | null>(null);

/** Close the enclosing DropdownMenu (for custom content such as inline forms). */
export function useMenuClose() {
  return useContext(MenuContext)?.close ?? (() => {});
}

export type MenuTriggerProps = {
  ref: Ref<HTMLButtonElement>;
  type: 'button';
  'aria-haspopup': 'menu' | 'dialog' | 'listbox';
  'aria-expanded': boolean;
  'aria-controls'?: string;
  onClick: () => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => void;
};

export type DropdownMenuProps = {
  /** Render the trigger; spread the props onto a <button>. */
  trigger: (props: MenuTriggerProps, state: { open: boolean }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: PopoverAlign;
  side?: PopoverSide;
  width?: number | 'anchor';
  label?: string;
  /** 'dialog' for menus that hold forms (Tab stays inside, no arrow navigation). */
  role?: 'menu' | 'dialog' | 'listbox';
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function DropdownMenu({
  trigger,
  children,
  align = 'start',
  side = 'bottom',
  width,
  label,
  role = 'menu',
  className,
  open: controlled,
  onOpenChange,
}: DropdownMenuProps) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlled ?? uncontrolled;
  const setOpen = useCallback(
    (v: boolean) => {
      if (controlled === undefined) setUncontrolled(v);
      onOpenChange?.(v);
    },
    [controlled, onOpenChange]
  );
  const anchorRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), [setOpen]);
  // Closing from an item returns focus to the trigger (after the panel unmounts).
  const [refocus, setRefocus] = useState(0);
  useEffect(() => {
    if (refocus) anchorRef.current?.focus();
  }, [refocus]);
  const closeAndFocus = useCallback(() => {
    setOpen(false);
    setRefocus((n) => n + 1);
  }, [setOpen]);

  const props: MenuTriggerProps = {
    ref: anchorRef,
    type: 'button',
    'aria-haspopup': role,
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
    onClick: () => setOpen(!open),
    onKeyDown: (e) => {
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !open) {
        e.preventDefault();
        setOpen(true);
      }
    },
  };

  return (
    <>
      {trigger(props, { open })}
      <MenuContext.Provider value={{ close: closeAndFocus }}>
        <Popover
          open={open}
          onClose={close}
          anchorRef={anchorRef}
          align={align}
          side={side}
          width={width}
          role={role}
          label={label}
          id={id}
          className={className}
        >
          {typeof children === 'function' ? children(closeAndFocus) : children}
        </Popover>
      </MenuContext.Provider>
    </>
  );
}

type ItemBase = {
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
  /** Leading icon. */
  icon?: ReactNode;
  /** Trailing text such as a count or shortcut. */
  hint?: ReactNode;
  title?: string;
};

export function MenuItem({ children, onSelect, disabled, danger, className, icon, hint, title, keepOpen }: ItemBase & { keepOpen?: boolean }) {
  const ctx = useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      data-menu-item=""
      tabIndex={-1}
      disabled={disabled}
      data-danger={danger || undefined}
      title={title}
      onClick={() => {
        onSelect?.();
        if (!keepOpen) ctx?.close();
      }}
      className={cn('menu-item disabled:cursor-not-allowed disabled:opacity-50', className)}
    >
      {icon && <span className="inline-flex shrink-0 text-muted-foreground [&>svg]:size-4">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint != null && <span className="shrink-0 font-mono text-[11px] text-faint">{hint}</span>}
    </button>
  );
}

/** Toggle item; stays open by default so several can be ticked. */
export function MenuCheckboxItem({
  checked,
  onCheckedChange,
  children,
  disabled,
  className,
  icon,
  hint,
  keepOpen = true,
}: Omit<ItemBase, 'onSelect' | 'danger'> & { checked: boolean; onCheckedChange: (v: boolean) => void; keepOpen?: boolean }) {
  const ctx = useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      data-menu-item=""
      tabIndex={-1}
      disabled={disabled}
      onClick={() => {
        onCheckedChange(!checked);
        if (!keepOpen) ctx?.close();
      }}
      className={cn('menu-item', className)}
    >
      <span
        aria-hidden
        className={cn(
          'inline-grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors',
          checked ? 'border-ember bg-ember text-[hsl(40_53%_97%)] dark:text-[hsl(24_12%_8%)]' : 'border-border-strong bg-card text-transparent'
        )}
      >
        <Check size={11} strokeWidth={3} />
      </span>
      {icon && <span className="inline-flex shrink-0 [&>svg]:size-4">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint != null && <span className="shrink-0 font-mono text-[11px] text-faint">{hint}</span>}
    </button>
  );
}

/** Single-choice item; closes the menu by default. */
export function MenuRadioItem({
  checked,
  onSelect,
  children,
  disabled,
  className,
  icon,
  hint,
  keepOpen,
}: Omit<ItemBase, 'danger'> & { checked: boolean; keepOpen?: boolean }) {
  const ctx = useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      data-menu-item=""
      tabIndex={-1}
      disabled={disabled}
      onClick={() => {
        onSelect?.();
        if (!keepOpen) ctx?.close();
      }}
      className={cn('menu-item', checked && 'font-medium', className)}
    >
      {icon && <span className="inline-flex shrink-0 [&>svg]:size-4">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint != null && <span className="shrink-0 font-mono text-[11px] text-faint">{hint}</span>}
      <Check size={14} aria-hidden className={cn('shrink-0 text-ember', !checked && 'invisible')} />
    </button>
  );
}

export function MenuLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint', className)}>{children}</div>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="menu-sep" />;
}
