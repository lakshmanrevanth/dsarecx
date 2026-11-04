'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LADDER_DAYS, QUEUE, ratingOutcome, type Rating } from './demo-data';

type Phase = 'recall' | 'reveal' | 'rated';

const RATINGS: { value: Rating; label: string; key: string }[] = [
  { value: 'struggled', label: 'Struggled', key: '1' },
  { value: 'shaky', label: 'Shaky', key: '2' },
  { value: 'clean', label: 'Clean', key: '3' },
];

// The order the autoplay walks through, and how long each phase is shown (ms).
const SCRIPT: Rating[] = ['clean', 'shaky', 'clean'];
const DWELL: Record<Phase, number> = { recall: 2600, reveal: 2400, rated: 1900 };

/**
 * The tilted paper card in the hero: one item from today's queue going through
 * recall → reveal → rate. Plays on its own until the visitor clicks anything,
 * then it is theirs to drive. Never autoplays with reduced motion.
 */
export function HeroCard() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('recall');
  const [rating, setRating] = useState<Rating | null>(null);
  const [auto, setAuto] = useState(true);
  const [done, setDone] = useState(0);

  const item = QUEUE[index];
  const playing = auto && !reduce;

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => {
      if (document.hidden) return;
      if (phase === 'recall') setPhase('reveal');
      else if (phase === 'reveal') {
        setRating(SCRIPT[index % SCRIPT.length]);
        setPhase('rated');
      } else advance();
    }, DWELL[phase]);
    return () => window.clearTimeout(t);
  }, [playing, phase, index]);

  function advance() {
    setIndex((i) => (i + 1) % QUEUE.length);
    setDone((d) => (d + 1) % (QUEUE.length + 1));
    setPhase('recall');
    setRating(null);
  }

  function rate(r: Rating) {
    setAuto(false);
    setRating(r);
    setPhase('rated');
  }

  const isConcept = item.platform === 'System design';

  return (
    <div className="relative mx-auto w-full max-w-[520px] lg:mx-0">
      <div
        className="card relative overflow-hidden rounded-2xl [background-image:repeating-linear-gradient(to_bottom,transparent_0,transparent_43px,var(--rule)_43px,var(--rule)_44px)] lg:-rotate-[2.5deg]"
        style={{ boxShadow: 'var(--shadow-pop)' }}
        aria-label="Example review card. Keys: Space reveals notes, 1 to 3 rate."
        role="group"
        onKeyDown={(e) => {
          if (e.target instanceof HTMLElement && e.target.closest('a')) return;
          if (e.key === ' ' && phase === 'recall') {
            e.preventDefault();
            setAuto(false);
            setPhase('reveal');
          } else if (['1', '2', '3'].includes(e.key)) {
            rate(RATINGS[Number(e.key) - 1].value);
          }
        }}
      >
        {/* Card header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          <span>Daily / {String(done + 1).padStart(2, '0')} of {QUEUE.length}</span>
          <span className="inline-flex items-center gap-2">
            <span className="ember-dot ember-dot-pulse" aria-hidden />
            Due today
          </span>
        </div>

        <div className="px-5 pb-5 pt-4 sm:px-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={item.id}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="chip chip-mono">{item.platform}</span>
                {item.difficulty ? (
                  <span className={cn('chip', `chip-${item.difficulty.toLowerCase()}`)}>{item.difficulty}</span>
                ) : (
                  <span className="chip chip-ember">Concept</span>
                )}
                {item.late ? <span className="chip chip-warning">{item.late}d late</span> : null}
              </div>

              <h3 className="mt-3 font-serif text-[34px] leading-[1.05] tracking-tight text-foreground sm:text-[40px]">
                {item.title}
              </h3>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
                {item.topic} · step {item.step + 1} of {LADDER_DAYS.length}
              </p>

              <div className="mt-4 rounded-lg border border-dashed border-border-strong bg-background/50 px-4 py-3">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ember-strong">
                  {isConcept ? 'Recall question' : 'Try to recall'}
                </p>
                <p className="mt-1 text-[15px] leading-snug text-foreground">{item.question}</p>
              </div>

              <div className="mt-3 min-h-[92px]">
                {phase === 'recall' ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setAuto(false);
                      setPhase('reveal');
                    }}
                  >
                    <Eye size={14} aria-hidden /> Reveal notes <span className="kbd ml-1">Space</span>
                  </button>
                ) : (
                  <motion.p
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-l-2 border-ember pl-3 text-[14px] leading-relaxed text-muted-foreground"
                  >
                    {item.notes}
                  </motion.p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Ratings */}
          <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Rate your recall">
            {RATINGS.map((r) => {
              const chosen = rating === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => rate(r.value)}
                  aria-pressed={chosen}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors',
                    chosen
                      ? r.value === 'clean'
                        ? 'border-ember bg-ember-soft'
                        : 'border-border-strong bg-muted'
                      : 'border-border bg-card hover:border-border-strong',
                  )}
                >
                  <span className="flex w-full items-center justify-between text-[13px] font-medium text-foreground">
                    {r.label}
                    <span className="kbd hidden sm:inline-grid">{r.key}</span>
                  </span>
                  <span className="font-mono text-[10.5px] text-muted-foreground">{ratingOutcome(item.step, r.value)}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
            <span aria-live="polite">
              {phase === 'rated' && rating
                ? `Next review ${ratingOutcome(item.step, rating)}`
                : `Ladder ${LADDER_DAYS.join(' → ')}`}
            </span>
            {phase === 'rated' && !playing ? (
              <button type="button" onClick={advance} className="link-underline normal-case tracking-normal text-foreground">
                Next →
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Stamp under the card, like a ticket stub */}
      <div
        aria-hidden
        className="absolute -bottom-5 right-6 hidden rotate-[3deg] rounded-full border border-border bg-foreground px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-background shadow-[var(--shadow-card)] sm:block"
      >
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-ember align-middle" />
        Scheduled before you forget
      </div>
    </div>
  );
}
