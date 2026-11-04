'use client';

import type { WeekPoint } from '@/app/api/stats/compute';
import {
  AXIS_FONT,
  CHART_CLASS,
  ChartTooltip,
  LegendItem,
  SrTable,
  TooltipRow,
  TooltipTitle,
  VIZ,
  pct,
  shortDate,
  useActiveIndex,
  useElementWidth,
} from './chart-utils';

const H = 220;
const M = { top: 16, right: 44, bottom: 28, left: 40 };
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1];

/** Weekly clean-recall rate: ember line with a soft area, review volume as faint ink columns behind it. */
export function RecallChart({ weeks }: { weeks: WeekPoint[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const { active, setActive, containerProps } = useActiveIndex(weeks.length);

  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = H - M.top - M.bottom;
  const band = weeks.length ? plotW / weeks.length : 0;
  const xAt = (i: number) => M.left + band * (i + 0.5);
  const yAt = (v: number) => M.top + plotH * (1 - v);
  const maxReviews = Math.max(1, ...weeks.map((w) => w.reviews));
  const volW = Math.max(2, Math.min(18, band * 0.45));

  // Line segments join consecutive weeks that have reviews; empty weeks leave a gap.
  const segments: { d: string; area: string }[] = [];
  let pts: [number, number][] = [];
  const flush = () => {
    if (!pts.length) return;
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('');
    const base = M.top + plotH;
    const area = `${d}L${pts[pts.length - 1][0]},${base}L${pts[0][0]},${base}Z`;
    segments.push({ d, area });
    pts = [];
  };
  weeks.forEach((w, i) => {
    if (w.cleanRate === null) flush();
    else pts.push([xAt(i), yAt(w.cleanRate)]);
  });
  flush();

  const labelEvery = Math.max(1, Math.ceil(60 / Math.max(1, band)));
  const lastIdx = weeks.reduce((acc, w, i) => (w.cleanRate !== null ? i : acc), -1);
  const withData = weeks.filter((w) => w.reviews > 0);
  const summary = withData.length
    ? `Line chart of weekly clean recall rate over the last ${weeks.length} weeks. ${withData.length} weeks have reviews; ` +
      `the latest week with reviews (${shortDate(weeks[lastIdx].weekStart)}) was ${pct(weeks[lastIdx].cleanRate)} clean. Use arrow keys to read each week.`
    : `No reviews in the last ${weeks.length} weeks.`;
  const a = active !== null ? weeks[active] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4" aria-hidden>
        <LegendItem color={VIZ.primary} label="Clean recall" shape="line" />
        <LegendItem color={VIZ.secondary} label="Review volume" />
      </div>
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
            <defs>
              <linearGradient id="recall-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={VIZ.primary} stopOpacity={0.18} />
                <stop offset="100%" stopColor={VIZ.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            {Y_TICKS.map((t) => (
              <g key={t}>
                <line
                  x1={M.left}
                  x2={width - M.right}
                  y1={yAt(t)}
                  y2={yAt(t)}
                  stroke={t === 0 ? VIZ.axis : VIZ.grid}
                  strokeDasharray={t === 0 ? undefined : '2 4'}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text x={M.left - 10} y={yAt(t)} dy="0.32em" textAnchor="end" {...AXIS_FONT} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t * 100}%
                </text>
              </g>
            ))}
            {/* Review volume (secondary, ink) */}
            {weeks.map((w, i) =>
              w.reviews > 0 ? (
                <rect
                  key={`v-${w.weekStart}`}
                  x={xAt(i) - volW / 2}
                  y={M.top + plotH - (w.reviews / maxReviews) * plotH * 0.35}
                  width={volW}
                  height={(w.reviews / maxReviews) * plotH * 0.35}
                  rx={2}
                  fill={VIZ.secondary}
                  opacity={active === i ? 0.32 : 0.14}
                />
              ) : null,
            )}
            {weeks.map((w, i) =>
              i % labelEvery === (weeks.length - 1) % labelEvery ? (
                <text key={w.weekStart} x={xAt(i)} y={H - 8} textAnchor="middle" {...AXIS_FONT}>
                  {shortDate(w.weekStart)}
                </text>
              ) : null,
            )}
            {a && (
              <line
                x1={xAt(active!)}
                x2={xAt(active!)}
                y1={M.top}
                y2={M.top + plotH}
                stroke={VIZ.axis}
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
            )}
            {segments.map((s, i) => (
              <g key={i}>
                <path d={s.area} fill="url(#recall-area)" />
                <path d={s.d} fill="none" stroke={VIZ.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              </g>
            ))}
            {weeks.map((w, i) =>
              w.cleanRate === null ? null : (
                <circle
                  key={w.weekStart}
                  cx={xAt(i)}
                  cy={yAt(w.cleanRate)}
                  r={active === i ? 5.5 : 3.5}
                  fill={active === i ? VIZ.primary : VIZ.surface}
                  stroke={VIZ.primary}
                  strokeWidth={2}
                />
              ),
            )}
            {lastIdx >= 0 && (
              <text
                x={xAt(lastIdx) + 10}
                y={yAt(weeks[lastIdx].cleanRate!)}
                dy="0.32em"
                fontSize={12}
                fontFamily="var(--font-mono)"
                fontWeight={500}
                fill={VIZ.ink}
              >
                {pct(weeks[lastIdx].cleanRate)}
              </text>
            )}
            {/* Hit bands: the whole column snaps to the nearest week. */}
            {weeks.map((w, i) => (
              <rect
                key={`hit-${w.weekStart}`}
                x={M.left + band * i}
                y={M.top}
                width={band}
                height={plotH}
                fill="transparent"
                onPointerEnter={() => setActive(i)}
                onPointerMove={() => setActive(i)}
              />
            ))}
          </svg>
        )}
        {a && (
          <ChartTooltip x={xAt(active!)} y={a.cleanRate === null ? M.top + plotH / 2 : yAt(a.cleanRate) - 12} containerWidth={width}>
            <TooltipTitle>Week of {shortDate(a.weekStart)}</TooltipTitle>
            {a.reviews === 0 ? (
              <p>No reviews</p>
            ) : (
              <>
                <TooltipRow value={pct(a.cleanRate)} label="clean recall" swatch={VIZ.primary} />
                <TooltipRow value={a.reviews} label={a.reviews === 1 ? 'review' : 'reviews'} swatch={VIZ.secondary} />
                <p className="mt-1 font-mono text-[11px]">
                  {a.clean} clean · {a.shaky} shaky · {a.struggled} struggled
                </p>
              </>
            )}
          </ChartTooltip>
        )}
      </div>
      <div aria-live="polite" className="sr-only">
        {a
          ? `Week of ${shortDate(a.weekStart)}: ${a.reviews ? `${pct(a.cleanRate)} clean, ${a.reviews} reviews (${a.clean} clean, ${a.shaky} shaky, ${a.struggled} struggled)` : 'no reviews'}`
          : ''}
      </div>
      <SrTable
        caption="Clean recall rate by week"
        head={['Week starting', 'Reviews', 'Clean', 'Shaky', 'Struggled', 'Clean rate']}
        rows={weeks.map((w) => [w.weekStart, w.reviews, w.clean, w.shaky, w.struggled, pct(w.cleanRate)])}
      />
    </div>
  );
}
