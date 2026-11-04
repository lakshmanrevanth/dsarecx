import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { describeUpcoming, type Upcoming } from './all-done';

/**
 * No due items and nothing rated today.
 * isNewUser: the user has nothing tracked yet, so explain how reviews work instead of "all caught up".
 */
export function EmptyState({
  isNewUser = false,
  upcoming,
  todayKey,
  ladder = [3, 7, 14, 30],
}: {
  isNewUser?: boolean;
  upcoming?: Upcoming;
  todayKey?: string;
  ladder?: readonly number[];
}) {
  const next = todayKey ? describeUpcoming(upcoming, todayKey) : null;

  if (isNewUser) {
    return (
      <section aria-label="Getting started" className="card px-6 py-12 md:px-12 md:py-16">
        <p className="eyebrow">First review</p>
        <h2 className="display mt-5 text-5xl text-foreground md:text-6xl">
          Start your <em>ladder.</em>
        </h2>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Add a problem you&apos;ve solved and it shows up here in {ladder[0]} days, then again after {ladder[1]},{' '}
          {ladder[2]} and {ladder[3]} days as you keep remembering it. Each time, try to recall it first, then rate how it went.
        </p>

        <ol className="mt-10 grid grid-cols-2 border-y border-border sm:grid-cols-4" aria-label="Review intervals">
          {ladder.slice(0, 4).map((d, i) => (
            <li
              key={i}
              className="border-border px-4 py-5 [&:nth-child(odd)]:border-r sm:border-r sm:last:border-r-0 max-sm:[&:nth-child(-n+2)]:border-b"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Step {i + 1}</p>
              <p className="mt-2 font-serif text-4xl leading-none text-foreground">
                {d}
                <span className="ml-1 font-sans text-sm text-muted-foreground">days</span>
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-10">
          <Link href="/dashboard" className="btn btn-primary btn-lg">
            Add your first problem <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Nothing due" className="card px-6 py-14 text-center md:py-20">
      <p className="eyebrow justify-center">All caught up</p>
      <h2 className="display mt-5 text-5xl text-foreground md:text-6xl">
        Nothing due <em>today.</em>
      </h2>
      <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
        No problems due today.{next ? ` ${next}.` : ''} Add new problems from the table any time.
      </p>
      <div className="mt-8">
        <Link href="/dashboard" className="btn btn-outline">
          Go to problems table <ArrowRight size={15} strokeWidth={1.75} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
