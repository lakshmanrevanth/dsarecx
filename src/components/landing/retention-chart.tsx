'use client';

import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { LADDER_DAYS } from './demo-data';

// A simple exponential model, R(t) = e^(-t/S), good enough to show the shape.
// Each review resets recall to 100% and makes the memory more stable.
const DAYS = 60;
const BASE_STABILITY = 1.66; // ~30% left after 2 days, the classic curve
const STABILITY_AFTER = [5, 12, 28, 90]; // after review 1..4

/** Day numbers (since solving) on which each ladder review happens. */
export const REVIEW_DAYS = LADDER_DAYS.reduce<number[]>((acc, gap) => [...acc, (acc.at(-1) ?? 0) + gap], []);

export function retentionWithoutReview(t: number) {
  return Math.exp(-t / BASE_STABILITY);
}

export function retentionWithReviews(t: number) {
  let last = 0;
  let s = BASE_STABILITY;
  for (let i = 0; i < REVIEW_DAYS.length; i++) {
    if (t < REVIEW_DAYS[i]) break;
    last = REVIEW_DAYS[i];
    s = STABILITY_AFTER[i];
  }
  return Math.exp(-(t - last) / s);
}

const W = 640;
const H = 300;
const PAD = { l: 44, r: 16, t: 16, b: 34 };
const x = (t: number) => PAD.l + (t / DAYS) * (W - PAD.l - PAD.r);
const y = (r: number) => PAD.t + (1 - r) * (H - PAD.t - PAD.b);

function pathFor(fn: (t: number) => number) {
  const pts: string[] = [];
  for (let i = 0; i <= DAYS * 8; i++) {
    const t = i / 8;
    // Draw the vertical jump at a review day explicitly.
    if (fn === retentionWithReviews && REVIEW_DAYS.includes(t)) {
      pts.push(`L${x(t).toFixed(1)},${y(fn(t - 0.0001)).toFixed(1)}`);
    }
    pts.push(`${i === 0 ? 'M' : 'L'}${x(t).toFixed(1)},${y(fn(t)).toFixed(1)}`);
  }
  return pts.join(' ');
}

const PATH_NONE = pathFor(retentionWithoutReview);
const PATH_REVIEWS = pathFor(retentionWithReviews);

export function RetentionChart() {
  const reduce = useReducedMotion();
  const [showReviews, setShowReviews] = useState(true);
  const titleId = useId();
  const descId = useId();

  return (
    <figure className="card p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="w-5 border-t-2 border-dashed border-[var(--chart-2)] opacity-60" />
            Solve once, never review
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="h-0.5 w-5 bg-ember" />
            Review on the ladder
          </span>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
          <input
            type="checkbox"
            checked={showReviews}
            onChange={(e) => setShowReviews(e.target.checked)}
            className="h-4 w-4 accent-[var(--ember)]"
          />
          Show reviews
        </label>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        className="mt-5 h-auto w-full overflow-visible"
      >
        <title id={titleId}>Memory retention over 60 days</title>
        <desc id={descId}>
          Without review, recall drops to about 30% after two days and near zero within a week. With reviews on days{' '}
          {REVIEW_DAYS.join(', ')}, recall returns to 100% each time and decays more slowly after every review.
        </desc>

        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((r) => (
          <g key={r}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(r)} y2={y(r)} stroke="var(--border)" strokeWidth="1" />
            <text x={PAD.l - 8} y={y(r) + 4} textAnchor="end" className="fill-[var(--faint)] font-mono text-[10px]">
              {Math.round(r * 100)}%
            </text>
          </g>
        ))}
        {[0, 10, 20, 30, 40, 50, 60].map((d) => (
          <text key={d} x={x(d)} y={H - 10} textAnchor="middle" className="fill-[var(--faint)] font-mono text-[10px]">
            {d === 0 ? 'day 0' : d}
          </text>
        ))}

        {/* Review markers */}
        {showReviews
          ? REVIEW_DAYS.map((d, i) => (
              <g key={d}>
                <line x1={x(d)} x2={x(d)} y1={y(1)} y2={y(0)} stroke="var(--ember)" strokeOpacity="0.25" strokeDasharray="3 4" />
                <text x={x(d) + 4} y={y(1) - 4} className="fill-[var(--ember-strong)] font-mono text-[10px]">
                  +{LADDER_DAYS[i]}
                </text>
              </g>
            ))
          : null}

        {/* Curves */}
        <path d={PATH_NONE} fill="none" stroke="var(--chart-2)" strokeOpacity="0.55" strokeWidth="1.75" strokeDasharray="5 5" />
        {showReviews ? (
          <motion.path
            key="reviews"
            d={PATH_REVIEWS}
            fill="none"
            stroke="var(--ember)"
            strokeWidth="2.25"
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, ease: 'easeInOut' }}
          />
        ) : null}
      </svg>
      <figcaption className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
        Illustrative model of the Ebbinghaus forgetting curve. Each review restores recall and slows the next decline.
      </figcaption>
    </figure>
  );
}
