'use client';

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ConfirmDialogProps = {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Destructive styling for the confirm button (default true). */
  danger?: boolean;
};

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Modal confirm with a focus trap; Cancel is focused first and focus returns to the opener. */
export function ConfirmDialog({ title, description, confirmLabel, onConfirm, onCancel, danger = true }: ConfirmDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <div aria-hidden className="overlay z-[110] animate-in fade-in-0 duration-150" onClick={onCancel} />
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        className="modal z-[111] w-[min(420px,calc(100vw-32px))] p-6"
      >
        <p className="eyebrow mb-3">{danger ? 'Confirm' : 'Check'}</p>
        <h2 id={titleId} className="display text-[28px] leading-tight text-foreground">
          {title}
        </h2>
        <div id={descId} className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          {description}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="btn btn-outline">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className={danger ? 'btn btn-danger' : 'btn btn-primary'}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
