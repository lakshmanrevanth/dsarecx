'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const canMatch = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/** Non-hook check for effects and imperative code (always false on the server). */
export function prefersReducedMotion(): boolean {
  return canMatch() && window.matchMedia(QUERY).matches;
}

function subscribe(onChange: () => void) {
  if (!canMatch()) return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/**
 * True when the user asked the OS/browser to minimise motion. Updates live if
 * the setting changes while the page is open. False during SSR and hydration.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
