'use client';

import {
  CHART_CLASS,
  ChartTooltip,
  SrTable,
  TooltipRow,
  TooltipTitle,
  VIZ,
  rightRoundedBar,
  useActiveIndex,
  useElementWidth,
} from './chart-utils';

const ROW = 40;
const BAR = 12;
const LABEL_W = 116;
const VALUE_W = 44;

/** Horizontal bars: active items on each ladder step (ember), then mastered (ink). */
export function LadderChart({ steps, mastered, ladderDays }: { steps: number[]; mastered: number; ladderDays: number[] }) {
  const rows = [
    ...steps.map((count, i) => ({ label: `Step ${i + 1}`, sub: ladderDays[i] ? `${ladderDays[i]}-day gap` : '', count, mastered: false })),
    { label: 'Mastered', sub: 'rechecks only', count: mastered, mastered: true },
  ];
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const { active, setActive, containerProps } = useActiveIndex(rows.length, 'first');
  const total = rows.reduce((n, r) => n + r.count, 0);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const plotW = Math.max(0, width - LABEL_W - VALUE_W);
  const H = rows.length * ROW;
  const summary = `Bar chart of items by ladder step: ${rows.map((r) => `${r.label} ${r.count}`).join(', ')}. Use arrow keys to read each row.`;
  const a = active !== null ? rows[active] : null;

  return (
    <div>
      <div
        ref={ref}
        data-chart
        role="group"
        aria-roledescription="chart"
        aria-label={summary}
        {...containerProps}
        className={CHART_CLASS}
        style={{ height: H }}
      >
        {width > 0 && (
          <svg width={width} height={H} aria-hidden="true" className="block overflow-visible">
            {rows.map((r, i) => {
              const y = i * ROW;
              const w = (r.count / max) * plotW;
              const color = r.mastered ? VIZ.secondary : VIZ.primary;
              return (
                <g key={r.label} opacity={active !== null && active !== i ? 0.5 : 1}>
                  {i > 0 && (
                    <line x1={0} x2={width} y1={y} y2={y} stroke={VIZ.grid} strokeWidth={1} shapeRendering="crispEdges" />
                  )}
                  <text x={0} y={y + ROW / 2 - 7} dy="0.32em" fontSize={13} fontWeight={500} fill={VIZ.ink}>
                    {r.label}
                  </text>
                  <text x={0} y={y + ROW / 2 + 8} dy="0.32em" fontSize={10.5} fontFamily="var(--font-mono)" fill={VIZ.label}>
                    {r.sub.toUpperCase()}
                  </text>
                  <rect x={LABEL_W} y={y + (ROW - BAR) / 2} width={plotW} height={BAR} rx={BAR / 2} fill="var(--muted)" />
                  {r.count > 0 && <path d={rightRoundedBar(LABEL_W, y + (ROW - BAR) / 2, Math.max(4, w), BAR, BAR / 2)} fill={color} />}
                  <text
                    x={width}
                    y={y + ROW / 2}
                    dy="0.32em"
                    textAnchor="end"
                    fontSize={13}
                    fontFamily="var(--font-mono)"
                    fontWeight={500}
                    fill={VIZ.ink}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {r.count}
                  </text>
                  <rect
                    x={0}
                    y={y}
                    width={width}
                    height={ROW}
                    fill="transparent"
                    onPointerEnter={() => setActive(i)}
                    onPointerMove={() => setActive(i)}
                  />
                </g>
              );
            })}
          </svg>
        )}
        {a && (
          <ChartTooltip x={LABEL_W + plotW / 2} y={active! * ROW + 4} containerWidth={width}>
            <TooltipTitle>{a.label}</TooltipTitle>
            <TooltipRow value={a.count} label={a.count === 1 ? 'item' : 'items'} swatch={a.mastered ? VIZ.secondary : VIZ.primary} />
            <TooltipRow value={total ? `${Math.round((a.count / total) * 100)}%` : '—'} label="of items in rotation" />
          </ChartTooltip>
        )}
      </div>
      <div aria-live="polite" className="sr-only">
        {a ? `${a.label}: ${a.count} ${a.count === 1 ? 'item' : 'items'}` : ''}
      </div>
      <SrTable caption="Items by ladder step" head={['Step', 'Items']} rows={rows.map((r) => [r.sub ? `${r.label} (${r.sub})` : r.label, r.count])} />
    </div>
  );
}
