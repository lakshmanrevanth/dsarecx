'use client';

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/** Kept for API parity with code that wraps the app in a provider. */
export function TooltipProvider({ children }: { children: ReactNode; delay?: number }) {
  return <>{children}</>;
}

type TooltipProps = {
  content: ReactNode;
  /** A single focusable element (button, link). It gets aria-describedby. */
  children: ReactElement<Record<string, unknown>>;
  side?: 'top' | 'bottom';
  delay?: number;
  className?: string;
};

/**
 * Small ink label shown on hover and keyboard focus, hidden by Escape.
 * Rendered in a portal so table overflow can't clip it.
 */
export function Tooltip({ content, children, side = 'top', delay = 350, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const show = (immediate = false) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), immediate ? 0 : delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
    setPos(null);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const el = wrapRef.current?.firstElementChild ?? wrapRef.current;
    const tip = tipRef.current;
    if (!el || !tip) return;
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const fitsTop = r.top - h - 8 > 0;
    const top = side === 'top' && fitsTop ? r.top - h - 6 : r.bottom + 6;
    const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8));
    setPos({ top, left });
  }, [open, side]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
    };
  }, [open]);

  if (!content) return children;
  const child = isValidElement(children)
    ? cloneElement(children, { 'aria-describedby': open ? id : undefined })
    : children;

  return (
    <span
      ref={wrapRef}
      className="inline-flex"
      onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
      onPointerLeave={hide}
      onFocus={() => show(true)}
      onBlur={hide}
    >
      {child}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            className={cn(
              'pointer-events-none fixed z-[120] max-w-[260px] rounded-md bg-primary px-2.5 py-1.5 text-xs leading-snug text-primary-foreground shadow-pop',
              pos ? 'animate-in fade-in-0 duration-150' : 'opacity-0',
              className
            )}
            style={{ top: pos?.top ?? 0, left: pos?.left ?? 0 }}
          >
            {content}
          </div>,
          document.body
        )}
    </span>
  );
}
