'use client';

// Shared pieces for the Stats page's hand-built SVG charts: container width,
// keyboard/pointer focus on one data index, tooltip, nice ticks, formatters.
// Colours: ember is the primary series, ink (--chart-2) the secondary; both read in light and dark.

import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const VIZ = {
  primary: 'var(--ember)',
  secondary: 'var(--chart-2)',
  grid: 'var(--border)',
  axis: 'var(--border-strong)',
  label: 'var(--muted-foreground)',
  ink: 'var(--foreground)',
  surface: 'var(--card)',
} as const;

/** Mono 11px for SVG axis text. */
export const AXIS_FONT = { fontSize: 11, fontFamily: 'var(--font-mono)', fill: VIZ.label } as const;

/** Width of a container element, kept up to date with a ResizeObserver. 0 until measured. */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.floor(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width ?? 0);
      setWidth((prev) => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * One "active" data index shared by hover and keyboard. The chart container is a single
 * tab stop; ←/→ (and Home/End) move between points, Escape clears.
 */
export function useActiveIndex(length: number, initial: 'first' | 'last' = 'last') {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!length) return;
      let next: number | null = null;
      const cur = active ?? (initial === 'last' ? length - 1 : 0);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(length - 1, active === null ? cur : cur + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, active === null ? cur : cur - 1);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = length - 1;
      else if (e.key === 'Escape') {
        setActive(null);
        return;
      } else return;
      e.preventDefault();
      setActive(next);
    },
    [active, length, initial],
  );
  const containerProps = {
    tabIndex: 0,
    onKeyDown,
    onFocus: () => setActive((a) => a ?? (length ? (initial === 'last' ? length - 1 : 0) : null)),
    onBlur: () => setActive(null),
    onPointerLeave: () => setActive(null),
  };
  return { active, setActive, containerProps };
}

/** Round-number ticks from 0 to at least `max`. */
export function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const stepInt = Math.max(1, Math.ceil(step));
  const ticks: number[] = [];
  for (let v = 0; v < max + stepInt; v += stepInt) {
    ticks.push(v);
    if (v >= max) break;
  }
  return ticks;
}

export const pct = (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits)}%`);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "Nov 3" from "2026-11-03" (no timezone conversion: the key is already a local day). */
export function shortDate(key: string) {
  const [, m, d] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}
export function weekdayDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${MONTHS[m - 1]} ${d}`;
}

/** SVG path for a bar with rounded top corners and a square base. */
export function topRoundedBar(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0 || w <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** SVG path for a horizontal bar with a square start and a rounded end. */
export function rightRoundedBar(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0 || w <= 0) return '';
  const rr = Math.min(r, h / 2, w);
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}

/** Tooltip box positioned over a chart; clamps to stay inside the container. */
export function ChartTooltip({ x, y, containerWidth, children }: { x: number; y: number; containerWidth: number; children: ReactNode }) {
  const W = 184;
  const left = Math.max(0, Math.min(containerWidth - W, x - W / 2));
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 -translate-y-full rounded-lg border border-border bg-popover px-3 py-2.5 text-[12px] text-muted-foreground shadow-[var(--shadow-pop)]"
      style={{ left, top: Math.max(0, y), width: W }}
    >
      {children}
    </div>
  );
}

export function TooltipTitle({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-foreground">{children}</p>;
}

export function TooltipRow({ value, label, swatch }: { value: ReactNode; label: string; swatch?: string }) {
  return (
    <div className="flex items-center gap-2 leading-[19px]">
      {swatch && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: swatch }} />}
      <span className="font-medium tabular-nums text-foreground">{value}</span>
      <span>{label}</span>
    </div>
  );
}

export function LegendItem({ color, label, shape = 'dot' }: { color: string; label: string; shape?: 'dot' | 'line' }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
      <span
        aria-hidden="true"
        className={cn(shape === 'dot' ? 'h-2 w-2 rounded-full' : 'h-[2px] w-3.5 rounded-full')}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

/** Shared classes for a focusable chart container. */
export const CHART_CLASS = 'relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card';

/** A visually hidden data table: the non-visual twin of a chart. */
export function SrTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) =>
              j === 0 ? (
                <th key={j} scope="row">
                  {c}
                </th>
              ) : (
                <td key={j}>{c}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
