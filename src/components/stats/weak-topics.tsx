import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { WeakTopic } from '@/app/api/stats/compute';
import { VIZ, pct } from './chart-utils';

const KIND_LABEL: Record<WeakTopic['kind'], string> = { problem: 'Problems', concept: 'Concepts', mixed: 'Mixed' };

function KindTag({ kind }: { kind: WeakTopic['kind'] }) {
  const dots = kind === 'mixed' ? [VIZ.primary, VIZ.secondary] : [kind === 'concept' ? VIZ.secondary : VIZ.primary];
  return (
    <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
      {dots.map((c) => (
        <span key={c} aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      ))}
      {KIND_LABEL[kind]}
    </span>
  );
}

/** Ranked list: topics with the biggest share of struggled (+½ shaky) reviews in the last 90 days. */
export function WeakTopics({ topics }: { topics: WeakTopic[] }) {
  if (!topics.length) {
    return (
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        No weak spots yet. A topic shows up here once it has at least 3 reviews in the last 90 days and some of them were shaky or a
        struggle.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-border border-y border-border">
      {topics.map((t, i) => {
        const label = `${t.topic}: ${pct(t.struggleRate)} struggle share, ${pct(t.cleanRate)} clean over ${t.reviews} reviews (${t.struggled} struggled, ${t.shaky} shaky). Open in the dashboard.`;
        return (
          <li key={t.topic}>
            <Link
              href={`/dashboard?topic=${encodeURIComponent(t.topic)}`}
              aria-label={label}
              title={`${t.struggled} struggled · ${t.shaky} shaky · ${t.clean} clean`}
              className="group grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-md px-1 py-3 transition-colors hover:bg-[hsl(16_100%_56%/0.04)] focus-visible:outline-offset-[-2px]"
            >
              <span className="font-serif text-xl leading-none text-faint">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="truncate text-[14.5px] font-medium text-foreground">{t.topic}</span>
                <KindTag kind={t.kind} />
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap font-mono text-[12px] text-muted-foreground">
                <span className="font-medium text-foreground">{pct(t.struggleRate)}</span> struggle
                <ArrowUpRight size={13} strokeWidth={1.75} aria-hidden className="text-faint transition-colors group-hover:text-ember" />
              </span>
              <span />
              <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full min-w-1 rounded-full"
                  style={{ width: `${Math.min(100, t.struggleRate * 100)}%`, background: VIZ.primary }}
                />
              </span>
              <span className="whitespace-nowrap text-right font-mono text-[11px] text-muted-foreground">
                {t.reviews} reviews · {pct(t.cleanRate)} clean
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
