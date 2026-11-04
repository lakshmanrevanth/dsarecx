'use client';

import { useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';

const noopSubscribe = () => () => {};

/**
 * Number of items due today (overdue included), for the nav badge.
 * The daily page revalidates `/api/problems/due` after every rating, snooze or undo.
 * Returns null until hydrated, so the localStorage SWR cache can't cause a mismatch.
 */
export function useDueCount(): number | null {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const { data } = useSWR<unknown>(hydrated ? '/api/problems/due' : null, fetcher, {
    revalidateOnFocus: true,
    focusThrottleInterval: 60_000,
  });
  if (!hydrated || !Array.isArray(data)) return null;
  return data.length;
}

export function formatBadge(n: number): string {
  return n > 99 ? '99+' : String(n);
}
