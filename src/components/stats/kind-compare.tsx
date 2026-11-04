import type { KindStats } from '@/app/api/stats/compute';
import { VIZ, pct } from './chart-utils';

function Column({ name, color, stats }: { name: string; color: string; stats: KindStats }) {
  const rate = stats.cleanRate90;
  const rows: [string, string | number][] = [
    ['Tracked', stats.items],
    ['Reviews · 90d', stats.reviews90],
    ['Clean recall', pct(rate)],
  ];
  return (
    <div className="min-w-0">
      <p className="mb-3 flex items-center gap-2 text-[14px] font-medium text-foreground">
        <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: color }} />
        {name}
      </p>
      <dl className="divide-y divide-border border-y border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 py-2">
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{k}</dt>
            <dd className="font-mono text-[13px] font-medium tabular-nums text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <div
        role="meter"
        aria-label={`${name} clean recall rate`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rate === null ? undefined : Math.round(rate * 100)}
        aria-valuetext={rate === null ? 'No reviews' : pct(rate)}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        {rate !== null && rate > 0 && <div className="h-full min-w-1 rounded-full" style={{ width: `${rate * 100}%`, background: color }} />}
      </div>
    </div>
  );
}

/** Problems vs concepts: how many, how often reviewed, how cleanly recalled (90 days). */
export function KindCompare({ problems, concepts }: { problems: KindStats; concepts: KindStats }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <Column name="Problems" color={VIZ.primary} stats={problems} />
      <Column name="Concepts" color={VIZ.secondary} stats={concepts} />
    </div>
  );
}
