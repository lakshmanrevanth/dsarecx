'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertCircle, Check, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONF_META } from './chips';

type Confidence = 'CLEAN' | 'SHAKY' | 'STRUGGLED';

export type UndoToastData = {
  problemId: string;
  revisionId?: string | null;
  title: string;
  confidence: Confidence;
};

export type ToastItem =
  | { id: string; kind: 'success' | 'error'; message: string }
  | ({ id: string; kind: 'undo' } & UndoToastData);

export type NewToast = { kind: 'success' | 'error'; message: string } | ({ kind: 'undo' } & UndoToastData);

const MAX_TOASTS = 5;
const DURATION = { success: 3000, error: 5000, undo: 7000 } as const;

let seq = 0;

/** One queue for every toast on the page. Undo toasts each keep their own problem + revision. */
export function useToastStack() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((t: NewToast) => {
    const id = `t${++seq}`;
    setToasts((prev) => {
      // A new undo for the same problem replaces the old one.
      const rest = t.kind === 'undo' ? prev.filter((p) => !(p.kind === 'undo' && p.problemId === t.problemId)) : prev;
      return [...rest, { ...t, id } as ToastItem].slice(-MAX_TOASTS);
    });
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissUndoFor = useCallback((problemId: string) => {
    setToasts((prev) => prev.filter((t) => !(t.kind === 'undo' && t.problemId === problemId)));
  }, []);

  const latestUndo = [...toasts].reverse().find((t) => t.kind === 'undo') as Extract<ToastItem, { kind: 'undo' }> | undefined;

  return { toasts, push, dismiss, dismissUndoFor, latestUndo };
}

type ToastStackProps = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onUndo: (toast: Extract<ToastItem, { kind: 'undo' }>) => Promise<void> | void;
};

const PROGRESS_CSS = '@keyframes dsx-toast-progress{from{transform:scaleX(1)}to{transform:scaleX(0)}}';

/** A single live region, newest at the bottom; toasts stack and never overlap. Sits above the mobile dock. */
export function ToastStack({ toasts, onDismiss, onUndo }: ToastStackProps) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-[70] flex flex-col items-stretch gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:w-[400px] md:items-end"
    >
      <style dangerouslySetInnerHTML={{ __html: PROGRESS_CSS }} />
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={onDismiss} onUndo={onUndo} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
  onUndo,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  onUndo: ToastStackProps['onUndo'];
}) {
  const duration = DURATION[toast.kind];
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const remaining = useRef<number>(duration);

  // Auto-dismiss, paused while hovered or focused.
  useEffect(() => {
    if (paused || isUndoing) return;
    const started = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - started));
    };
  }, [paused, isUndoing, onDismiss, toast.id]);

  const handleUndo = async () => {
    if (toast.kind !== 'undo' || isUndoing) return;
    setIsUndoing(true);
    try {
      await onUndo(toast);
    } finally {
      onDismiss(toast.id);
    }
  };

  const meta = toast.kind === 'undo' ? CONF_META[toast.confidence] ?? CONF_META.CLEAN : null;
  const barColor = meta ? meta.dot : toast.kind === 'error' ? 'bg-error' : 'bg-ember';

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      className={cn(
        'pointer-events-auto w-full overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-[var(--shadow-pop)]',
        toast.kind === 'error' ? 'border-error-border' : 'border-border',
      )}
    >
      <div className="flex items-center gap-3 py-3 pl-4 pr-2">
        {toast.kind === 'undo' ? (
          <>
            <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full border', meta!.chip)}>
              <Check size={14} strokeWidth={2.25} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-foreground">{toast.title}</p>
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                Marked <span className={cn('font-medium', meta!.text)}>{meta!.label}</span>
              </p>
            </div>
          </>
        ) : (
          <>
            {toast.kind === 'error' ? (
              <AlertCircle size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-error" />
            ) : (
              <span aria-hidden className="ember-dot h-1.5 w-1.5 shrink-0" />
            )}
            <p
              className={cn(
                'min-w-0 flex-1 text-[14px] [overflow-wrap:anywhere]',
                toast.kind === 'error' ? 'text-error' : 'text-foreground',
              )}
            >
              {toast.message}
            </p>
          </>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {toast.kind === 'undo' && (
            <button
              type="button"
              onClick={handleUndo}
              disabled={isUndoing}
              aria-label={`Undo rating for ${toast.title}`}
              aria-keyshortcuts="Control+Z Meta+Z"
              className="btn btn-outline btn-sm"
            >
              <RotateCcw size={13} strokeWidth={1.75} aria-hidden className={isUndoing ? 'animate-spin' : ''} />
              {isUndoing ? 'Undoing…' : 'Undo'}
            </button>
          )}
          <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss" className="btn btn-ghost btn-icon btn-sm">
            <X size={14} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>

      {/* Time left; stops while paused */}
      <div className="h-[2px] w-full bg-border/60">
        <div
          className={cn('h-full origin-left', barColor)}
          style={{
            animation: `dsx-toast-progress ${duration}ms linear forwards`,
            animationPlayState: paused || isUndoing ? 'paused' : 'running',
          }}
        />
      </div>
    </motion.div>
  );
}
