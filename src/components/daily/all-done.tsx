'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';

export type Upcoming = { date: string; count: number } | null | undefined;

/** "Next: 4 problems tomorrow" / "Next: 1 problem on Friday, Nov 7". `todayKey` is the local YYYY-MM-DD. */
export function describeUpcoming(upcoming: Upcoming, todayKey: string): string | null {
  if (!upcoming || upcoming.count <= 0) return null;
  const n = `${upcoming.count} ${upcoming.count === 1 ? 'problem' : 'problems'}`;
  const [y, m, d] = todayKey.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  if (upcoming.date <= todayKey) return `Next: ${n} today`;
  if (upcoming.date === tomorrow) return `Next: ${n} tomorrow`;
  const [uy, um, ud] = upcoming.date.split('-').map(Number);
  const label = new Date(Date.UTC(uy, um - 1, ud)).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `Next: ${n} on ${label}`;
}

type AllDoneProps = {
  streak: number;
  upcoming?: Upcoming;
  todayKey: string;
  goalMet?: boolean;
  goalBasedStreak?: boolean;
};

/** Shown when every due item has been rated today. */
export function AllDone({ streak, upcoming, todayKey, goalMet = true, goalBasedStreak = false }: AllDoneProps) {
  const reduceMotion = useReducedMotion();
  const next = describeUpcoming(upcoming, todayKey);
  return (
    <motion.section
      aria-label="All done for today"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="card relative overflow-hidden px-6 py-14 text-center md:py-20"
    >
      <div aria-hidden className="paper-lines pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative">
        <p className="eyebrow justify-center">Queue cleared</p>
        <h2 className="display mt-5 text-5xl text-foreground md:text-6xl">
          All <em>done.</em>
        </h2>
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          {next ?? 'Nothing else is scheduled yet. Add problems from the table.'}
        </p>
        {goalBasedStreak && !goalMet && (
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
            Your streak counts days you reach your daily goal, so today doesn&apos;t count yet.
          </p>
        )}
        <div className="mt-8 inline-flex items-baseline gap-3 rounded-full border border-border bg-background/70 px-5 py-2">
          <span className="font-serif text-3xl leading-none text-foreground">{streak}</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">day streak</span>
        </div>
        <div className="mt-8">
          <Link href="/dashboard" className="link-underline text-[14px] text-foreground">
            Add more problems
          </Link>
        </div>
      </div>
    </motion.section>
  );
}
