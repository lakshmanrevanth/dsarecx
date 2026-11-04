'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { DifficultyChip, ItemMark, LateChip, RecheckChip, TopicTag } from './chips';
import type { Confidence } from './intervals';
import { isPlainShortcut, RATING_KEYS } from './keyboard';
import { RatingButtons } from './rating-buttons';
import { RecallDetails, RecallPrompt } from './recall-panel';
import { RecallQuestions } from './recall-questions';
import type { DailyItem } from './summary-state';

type FocusDeckProps = {
  /** Unrated due problems, weakest first. The first one is the current card. */
  problems: DailyItem[];
  ladder?: readonly number[];
  pendingConf?: Confidence | null;
  onRate: (problem: DailyItem, conf: Confidence) => void;
  onSnooze: (problem: DailyItem, days: number) => void;
  onUndo: () => void;
  onExit: () => void;
};

/** One card at a time: 1/2/3 rate, Space reveals notes, S snoozes a day, U undoes, Esc exits. */
export function FocusDeck({ problems, ladder, pendingConf = null, onRate, onSnooze, onUndo, onExit }: FocusDeckProps) {
  const reduceMotion = useReducedMotion();
  const [initialTotal] = useState(problems.length);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const current = problems[0];
  // An undo can put a card back, so the total never shrinks below what's left.
  const total = Math.max(initialTotal, problems.length);
  const done = total - problems.length;
  const revealed = !!current && revealedId === current.id;

  useEffect(() => {
    cardRef.current?.focus();
  }, [current?.id]);

  // Latest values for the key handler without re-binding it on every render.
  const latest = useRef({ current, pendingConf, onRate, onSnooze, onUndo, onExit });
  useEffect(() => {
    latest.current = { current, pendingConf, onRate, onSnooze, onUndo, onExit };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPlainShortcut(e) || e.repeat) return;
      const s = latest.current;
      if (e.key === 'Escape') {
        e.preventDefault();
        s.onExit();
        return;
      }
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        s.onUndo();
        return;
      }
      if (!s.current || s.pendingConf) return;
      const conf = RATING_KEYS[e.key];
      if (conf) {
        e.preventDefault();
        s.onRate(s.current, conf);
      } else if (e.key === ' ') {
        // Space on a focused button should still press it.
        if ((e.target as HTMLElement)?.closest?.('button, a')) return;
        e.preventDefault();
        setRevealedId(s.current.id);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        s.onSnooze(s.current, 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const progressPct = total > 0 ? Math.round((done / total) * 100) : 100;

  return (
    <section aria-label="Focus mode" className="mx-auto max-w-[720px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow" aria-live="polite">
          {current ? `Card ${Math.min(done + 1, total)} of ${total}` : `${done} of ${total} reviewed`}
        </p>
        <div className="flex items-center gap-4">
          <div
            role="progressbar"
            aria-label="Focus mode progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            className="h-1 w-28 overflow-hidden rounded-full bg-muted sm:w-40"
          >
            <div className="h-full rounded-full bg-ember transition-[width] duration-300" style={{ width: `${progressPct}%` }} />
          </div>
          <button type="button" onClick={onExit} aria-keyshortcuts="Escape" className="btn btn-outline btn-sm">
            Exit focus <span className="kbd">Esc</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!current ? (
          <motion.div
            key="finished"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="card px-6 py-14 text-center"
          >
            <p className="eyebrow justify-center">Deck finished</p>
            <h2 className="display mt-4 text-5xl text-foreground">
              That&apos;s the <em>deck.</em>
            </h2>
            <p className="mt-4 text-[15px] text-muted-foreground">
              You reviewed {done} {done === 1 ? 'problem' : 'problems'}. Press <span className="kbd">U</span> to undo the last one.
            </p>
            <button type="button" onClick={onExit} className="btn btn-primary mt-8">
              Back to the list
            </button>
          </motion.div>
        ) : (
          <motion.div
            key={current.id}
            ref={cardRef}
            tabIndex={-1}
            aria-label={`${current.title}. Press Space to reveal notes, 1, 2 or 3 to rate.`}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
            className="card p-5 outline-none sm:p-8 md:p-10"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <ItemMark problem={current} size={18} />
                <DifficultyChip difficulty={current.difficulty} />
                <TopicTag topic={current.topic} />
              </div>
              <div className="flex items-center gap-2">
                <RecheckChip show={current.isRecheck} />
                <LateChip days={current.daysOverdue} />
                {current.url && (
                  <a
                    href={current.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${current.title} in a new tab`}
                    className="btn btn-ghost btn-icon btn-sm"
                  >
                    <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
                  </a>
                )}
              </div>
            </div>

            <h2 className="display mt-6 text-4xl text-foreground [overflow-wrap:anywhere] sm:text-5xl">{current.title}</h2>

            <div className="mt-8 border-t border-border pt-6">
              {!revealed && <RecallQuestions key={current.id} problem={current} />}
              <RecallPrompt
                revealed={revealed}
                onReveal={() => {
                  setRevealedId(current.id);
                  requestAnimationFrame(() => cardRef.current?.focus({ preventScroll: true }));
                }}
                hint={
                  <span className="hidden text-[12px] text-muted-foreground sm:inline">
                    or press <span className="kbd">Space</span>
                  </span>
                }
              />
              {revealed && <RecallDetails problem={current} />}
            </div>

            <div className="mt-8">
              <p className="label">How did it go?</p>
              <RatingButtons problem={current} ladder={ladder} pendingConf={pendingConf} onRate={onRate} size="deck" />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-muted-foreground">
              <button
                type="button"
                onClick={() => onSnooze(current, 1)}
                aria-keyshortcuts="S"
                className="inline-flex items-center gap-1.5 underline decoration-border-strong underline-offset-4 hover:text-foreground"
              >
                Snooze to tomorrow
              </button>
              <span className="inline-flex items-center gap-1.5">
                <span className="kbd">S</span> snooze
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="kbd">U</span> undo last
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
