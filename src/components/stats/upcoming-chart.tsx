'use client';

import type { UpcomingDay } from '@/app/api/stats/compute';
import {
  AXIS_FONT,
  CHART_CLASS,
  ChartTooltip,
  LegendItem,
  SrTable,
  TooltipRow,
  TooltipTitle,
  VIZ,
  niceTicks,
  shortDate,
  topRoundedBar,
  useActiveIndex,
  useElementWidth,
  weekdayDate,
} from './chart-utils';

const H = 200;
const M = { top: 12, right: 8, bottom: 28, left: 32 };
const GAP = 2; // surface gap between stacked segments

/** Review load per local day for the next 30 days: problems (ember, bottom) + concepts (ink, top), stacked. */
export function UpcomingChart({ days, overdueCount }: { days: UpcomingDay[]; overdueCount: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const { active, setActive, containerProps } = useActiveIndex(days.length, 'first');

  const max = Math.max(0, ...days.map((d) => d.count));
  const ticks = niceTicks(max, 4);
  const top = ticks[ticks.length - 1];
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = H - M.top - M.bottom;
  const band = days.length ? plotW / days.length : 0;
  const barW = Math.max(2, Math.min(22, band - 3));
  const yAt = (v: number) => M.top + plotH * (1 - v / top);
  const xAt = (i: number) => M.left + band * i + (band - barW) / 2;
  const labelEvery = band >= 26 ? 3 : 7;

  const total = days.reduce((n, d) => n + d.count, 0);
  const totalConcepts = days.reduce((n, d) => n + d.concepts, 0);
  const busiest = days.reduce<UpcomingDay | null>((b, d) => (d.count > (b?.count ?? 0) ? d : b), null);
  const summary = total
    ? `Stacked column chart of reviews due each day for the next ${days.length} days: ${total} in total (${total - totalConcepts} problems, ${totalConcepts} concepts). ` +
      `Today has ${days[0]?.count ?? 0}${overdueCount ? `, including ${overdueCount} overdue` : ''}. Busiest day: ${busiest ? `${weekdayDate(busiest.date)} with ${busiest.count}` : 'none'}. Use arrow keys to read each day.`
    : `Nothing is scheduled for the next ${days.length} days.`;
  const a = active !== null ? days[active] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4" aria-hidden>
        <LegendItem color={VIZ.primary} label="Problems" />
        <LegendItem color={VIZ.secondary} label="Concepts" />
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
            {ticks.map((t) => (
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
                <text x={M.left - 8} y={yAt(t)} dy="0.32em" textAnchor="end" {...AXIS_FONT} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t}
                </text>
              </g>
            ))}
            {days.map((d, i) =>
              i % labelEvery === 0 ? (
                <text key={d.date} x={xAt(i) + barW / 2} y={H - 8} textAnchor={i === 0 ? 'start' : 'middle'} {...AXIS_FONT}>
                  {i === 0 ? 'Today' : shortDate(d.date)}
                </text>
              ) : null,
            )}
            {days.map((d, i) => {
              const problems = d.count - d.concepts;
              const x = xAt(i);
              const yProblems = yAt(problems);
              const hProblems = M.top + plotH - yProblems;
              const yTotal = yAt(d.count);
              // Concepts sit on top, separated from problems by a 2px surface gap.
              const hConcepts = d.concepts ? Math.max(0, yProblems - yTotal - (problems ? GAP : 0)) : 0;
              const dim = active !== null && active !== i;
              return (
                <g key={d.date} opacity={dim ? 0.45 : 1}>
                  {problems > 0 && (
                    <path
                      d={d.concepts ? `M${x},${yProblems}h${barW}V${M.top + plotH}H${x}Z` : topRoundedBar(x, yProblems, barW, hProblems, 3)}
                      fill={VIZ.primary}
                    />
                  )}
                  {hConcepts > 0 && <path d={topRoundedBar(x, yTotal, barW, hConcepts, 3)} fill={VIZ.secondary} />}
                </g>
              );
            })}
            {days.map((d, i) => (
              <rect
                key={`hit-${d.date}`}
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
          <ChartTooltip x={xAt(active!) + barW / 2} y={yAt(a.count) - 10} containerWidth={width}>
            <TooltipTitle>{active === 0 ? 'Today' : weekdayDate(a.date)}</TooltipTitle>
            <TooltipRow value={a.count} label={a.count === 1 ? 'review due' : 'reviews due'} />
            <TooltipRow value={a.count - a.concepts} label="problems" swatch={VIZ.primary} />
            <TooltipRow value={a.concepts} label="concepts" swatch={VIZ.secondary} />
            {active === 0 && overdueCount > 0 && <p className="mt-1">Includes {overdueCount} overdue</p>}
          </ChartTooltip>
        )}
      </div>
      <div aria-live="polite" className="sr-only">
        {a
          ? `${weekdayDate(a.date)}: ${a.count} due, ${a.count - a.concepts} problems, ${a.concepts} concepts${active === 0 && overdueCount ? `, ${overdueCount} overdue` : ''}`
          : ''}
      </div>
      <SrTable
        caption="Reviews due per day, next 30 days"
        head={['Date', 'Total', 'Problems', 'Concepts']}
        rows={days.map((d) => [d.date, d.count, d.count - d.concepts, d.concepts])}
      />
    </div>
  );
}
