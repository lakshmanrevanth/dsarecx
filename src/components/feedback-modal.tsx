'use client';

import { useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Mail, X } from 'lucide-react';
import { siteConfig } from '@/config/site';

type FeedbackModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function GitHubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}

/** Feedback dialog: open a GitHub issue (when a repo is configured) or send an email. */
export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const reduceMotion = useReducedMotion();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? dialogRef.current)?.focus();
    }, 0);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  const fade = { duration: reduceMotion ? 0 : 0.18 };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="feedback-overlay"
            className="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            key="feedback-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            tabIndex={-1}
            className="modal p-6 outline-none sm:p-8"
            initial={reduceMotion ? { opacity: 0, x: '-50%', y: '-50%' } : { opacity: 0, x: '-50%', y: 'calc(-50% + 8px)' }}
            animate={{ opacity: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, x: '-50%', y: reduceMotion ? '-50%' : 'calc(-50% + 8px)' }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close feedback dialog"
              className="btn btn-ghost btn-icon btn-sm absolute right-4 top-4"
            >
              <X size={16} strokeWidth={1.75} aria-hidden />
            </button>

            <p className="eyebrow">(01) Feedback</p>
            <h2 id={titleId} className="display mt-3 text-4xl text-foreground">
              Tell us what&apos;s <em>broken.</em>
            </h2>
            <p id={descId} className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Found a bug or have an idea for {siteConfig.name}? Pick whichever is easiest.
            </p>

            <div className="mt-6 divide-y divide-border border-y border-border">
              {siteConfig.githubUrl ? (
                <a
                  href={`${siteConfig.githubUrl}/issues/new`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="group flex items-start gap-4 py-4 transition-colors hover:text-foreground"
                >
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground">
                    <GitHubMark />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[15px] font-medium text-foreground">Open a GitHub issue</span>
                      <span className="chip chip-ember chip-mono h-5 px-2 text-[10px]">Recommended</span>
                    </span>
                    <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">
                      Bug reports and feature requests, tracked in the open.
                    </span>
                  </span>
                  <ArrowUpRight
                    size={16}
                    strokeWidth={1.75}
                    aria-hidden
                    className="mt-1 shrink-0 text-faint transition-colors group-hover:text-ember"
                  />
                </a>
              ) : null}

              <a
                href={`mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent(`${siteConfig.name} feedback`)}`}
                onClick={onClose}
                className="group flex items-start gap-4 py-4"
              >
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground">
                  <Mail size={16} strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-foreground">Send an email</span>
                  <span className="mt-1 block break-all text-[13px] leading-snug text-muted-foreground">
                    Write to {siteConfig.contactEmail}
                  </span>
                </span>
                <ArrowUpRight
                  size={16}
                  strokeWidth={1.75}
                  aria-hidden
                  className="mt-1 shrink-0 text-faint transition-colors group-hover:text-ember"
                />
              </a>
            </div>

            <p className="mt-5 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
              Every note gets read
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
