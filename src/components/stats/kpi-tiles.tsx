import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { StatsPayload } from '@/app/api/stats/compute';
import { cn } from '@/lib/utils';
import { pct } from './chart-utils';

const fmt = (n: number) => n.toLocaleString('en-US');

function Delta({ change }: { change: number | null }) {
  if (change === null) return <>No reviews in the 90 days before</>;
  const pts = Math.round(change * 100);
  const Icon = pts > 0 ? ArrowUpRight : pts < 0 ? ArrowDownRight : Minus;
  const tone = pts > 0 ? 'text-success' : pts < 0 ? 'text-error' : 'text-muted-foreground';
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Icon size={13} strokeWidth={2} aria-hidden className={tone} />
      <span className={cn('font-medium', tone)}>
        {pts > 0 ? '+' : pts < 0 ? '−' : '±'}
        {Math.abs(pts)} pts
      </span>
      <span>vs previous 90 days</span>
    </span>
  );
}

function Tile({ label, value, detail, accent, className }: { label: string; value: ReactNode; detail?: ReactNode; accent?: boolean; className?: string }) {
  return (
    <div className={cn('min-w-0 px-5 py-6 md:px-6', className)}>
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className={cn('mt-3 font-serif text-5xl leading-none tabular-nums', accent ? 'text-ember' : 'text-foreground')}>{value}</dd>
      {detail && <dd className="mt-3 text-[12.5px] leading-snug text-muted-foreground">{detail}</dd>}
    </div>
  );
}

/** Four headline figures in one ruled strip (2×2 on phones). */
export function KpiTiles({ stats }: { stats: StatsPayload }) {
  const { totals } = stats;
  const items = totals.active + totals.mastered + totals.retired;
  const dueToday = stats.upcoming[0]?.count ?? 0;
  return (
    <dl className="card grid grid-cols-2 overflow-hidden lg:grid-cols-4">
      <Tile
        label="Reviews · 30 days"
        value={fmt(totals.reviewsLast30)}
        detail={`${fmt(totals.reviewsAllTime)} all time`}
        className="border-b border-r border-border lg:border-b-0"
      />
      <Tile
        label="Clean recall · 90 days"
        value={pct(stats.overallCleanRate)}
        detail={stats.reviewsLast90 ? <Delta change={stats.cleanRateChange} /> : 'No reviews in the last 90 days'}
        accent
        className="border-b border-border lg:border-b-0 lg:border-r"
      />
      <Tile label="Mastered" value={fmt(totals.mastered)} detail={`of ${fmt(items)} tracked`} className="border-r border-border" />
      <Tile
        label="Overdue now"
        value={fmt(stats.overdueCount)}
        detail={dueToday ? `${fmt(dueToday)} due today in total` : 'Nothing due today'}
      />
    </dl>
  );
}
