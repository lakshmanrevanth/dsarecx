'use client';

// In-app confirmations for actions on the Today page ("Added", "Deleted · Undo").
// Polite live region; each toast closes on its own.

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Toast = {
  id: number;
  message: string;
  tone: 'default' | 'error';
  action?: { label: string; onClick: () => void };
};

type NewToast = Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone']; duration?: number };

let seq = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    ({ duration, tone = 'default', ...toast }: NewToast) => {
      const id = ++seq;
      setToasts((prev) => [...prev, { ...toast, tone, id }].slice(-3));
      timers.current.set(id, window.setTimeout(() => dismiss(id), duration ?? (toast.action ? 6000 : 3000)));
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => window.clearTimeout(t));
  }, []);

  return { toasts, push, dismiss };
}

export function ToastRegion({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-4 bottom-20 z-[90] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end md:bottom-6"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn('menu pointer-events-auto flex max-w-sm items-center gap-3 px-4 py-2.5 text-[13.5px]', t.tone === 'error' && 'text-error')}
        >
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', t.tone === 'error' ? 'bg-error' : 'bg-ember')} aria-hidden />
          <span className="min-w-0 flex-1">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="btn btn-ghost btn-sm -my-1 text-foreground"
              onClick={() => {
                t.action!.onClick();
                onDismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-icon btn-sm -my-1 -mr-2" aria-label="Dismiss" onClick={() => onDismiss(t.id)}>
            <X size={14} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
