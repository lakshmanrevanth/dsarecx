'use client';

import type { ReactNode } from 'react';
import { ArrowRight, Upload } from 'lucide-react';
import { siteConfig } from '@/config/site';

function Centered({ eyebrow, title, children, action }: { eyebrow: string; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center sm:py-20">
      <p className="eyebrow eyebrow-plain mb-4">{eyebrow}</p>
      <h3 className="display text-4xl text-foreground sm:text-[44px]">{title}</h3>
      {children && <p className="mt-3 max-w-[420px] text-[14px] leading-relaxed text-muted-foreground">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Shown when the user has no problems at all. */
export function FirstRunPanel({ onAdd, onImport, ladder = [3, 7, 14, 30] }: { onAdd: () => void; onImport: () => void; ladder?: readonly number[] }) {
  const steps = [
    {
      n: '01',
      title: 'Add by number or URL',
      body: (
        <>
          Type a LeetCode number like <code className="rounded bg-muted px-1 font-mono text-[12px] text-foreground">146</code>, or paste a link from
          LeetCode, Codeforces, GFG, HackerRank or CodeChef. The title and difficulty fill in for you.
        </>
      ),
      action: (
        <button type="button" onClick={onAdd} className="btn btn-ember btn-sm">
          Add a problem <ArrowRight size={14} aria-hidden />
        </button>
      ),
    },
    {
      n: '02',
      title: 'Or bring a spreadsheet',
      body: 'Already tracking problems in a sheet? Import a CSV or Excel file with its topics, notes and dates, or restore a JSON backup.',
      action: (
        <button type="button" onClick={onImport} className="btn btn-outline btn-sm">
          <Upload size={14} aria-hidden /> Import a file
        </button>
      ),
    },
    {
      n: '03',
      title: 'Review when it’s due',
      body: (
        <>
          Each problem comes back after <span className="font-mono text-foreground">{ladder.join(' → ')}</span> days. Clean moves it up the ladder,
          Shaky repeats the gap, Struggled starts it over. A clean review at the top masters it, with one recheck after 90 days.
        </>
      ),
    },
  ];
  return (
    <div className="px-5 py-12 sm:px-10 sm:py-16">
      <div className="mx-auto max-w-[880px]">
        <p className="eyebrow mb-4">Start here</p>
        <h3 className="display text-[44px] text-foreground sm:text-[56px]">
          Your ledger is <em>empty.</em>
        </h3>
        <p className="mt-3 max-w-[520px] text-[15px] leading-relaxed text-muted-foreground">
          Add the problems you solve and {siteConfig.name} tells you when to review each one, right before you&apos;d forget it.
        </p>
        <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="flex flex-col gap-3 bg-card p-5">
              <span className="font-mono text-[11px] tracking-[0.18em] text-ember">({s.n})</span>
              <span className="text-[15px] font-medium text-foreground">{s.title}</span>
              <span className="flex-1 text-[13px] leading-relaxed text-muted-foreground">{s.body}</span>
              {s.action && <span className="pt-1">{s.action}</span>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Shown when search or filters hide every row. */
export function NoMatches({ onClear, message = 'Nothing matches your search and filters.' }: { onClear: () => void; message?: string }) {
  return (
    <Centered
      eyebrow="No matches"
      title={
        <>
          Nothing <em>here.</em>
        </>
      }
      action={
        <button type="button" onClick={onClear} className="btn btn-outline btn-sm">
          Clear filters
        </button>
      }
    >
      {message}
    </Centered>
  );
}

/** Shown on the Due view when nothing is due. */
export function AllCaughtUp({ nextReview }: { nextReview: string | null }) {
  return (
    <Centered
      eyebrow="Due today · 0"
      title={
        <>
          All caught <em>up.</em>
        </>
      }
    >
      {nextReview ? (
        <>
          Next review <span className="font-medium text-foreground">{nextReview}</span>.
        </>
      ) : (
        'Nothing is scheduled. Add problems to start a review ladder.'
      )}
    </Centered>
  );
}

/** Generic empty view (bookmarks, an empty list). */
export function EmptyView({ eyebrow = 'Empty', heading, text }: { eyebrow?: string; heading: ReactNode; text: string }) {
  return (
    <Centered eyebrow={eyebrow} title={heading}>
      {text}
    </Centered>
  );
}
