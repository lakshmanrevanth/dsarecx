// Types and small helpers shared by the System Design page and its tabs.

import { endOfDay, format, formatDistanceToNowStrict, isBefore } from 'date-fns';
import type { ConceptLevel } from '@/lib/concepts/library';

export type ConceptStatus = 'ACTIVE' | 'MASTERED' | 'RETIRED';

/** A SYSTEM_DESIGN problem as returned by GET /api/concepts. */
export type TrackedConcept = {
  id: string;
  title: string;
  topic: string;
  difficulty: ConceptLevel;
  notes: string | null;
  url: string;
  code: string | null;
  dateSolved: string;
  status: ConceptStatus;
  currentStep: number;
  nextRevisionAt: string;
  revisionCount: number;
  revisions: { confidence: 'CLEAN' | 'SHAKY' | 'STRUGGLED'; revisedAt: string }[];
};

export const LEVEL_LABEL: Record<ConceptLevel, string> = { EASY: 'Basics', MEDIUM: 'Core', HARD: 'Advanced' };

export const noopSubscribe = () => () => {};

/** "YYYY-MM-DD" in the browser's timezone. */
export function localDateKey(d = new Date()) {
  return format(d, 'yyyy-MM-dd');
}

/** Two-digit mono counter: 4 → "04". */
export const pad2 = (n: number) => String(n).padStart(2, '0');

export function isDue(c: Pick<TrackedConcept, 'status' | 'nextRevisionAt'>) {
  return c.status !== 'RETIRED' && isBefore(new Date(c.nextRevisionAt), endOfDay(new Date()));
}

/** "Due now", "Next review Nov 12 · in 6 days", "Recheck Feb 2 · in 90 days", "Retired". */
export function nextReviewText(c: Pick<TrackedConcept, 'status' | 'nextRevisionAt'>, withDistance = true) {
  if (c.status === 'RETIRED') return 'Retired';
  const due = new Date(c.nextRevisionAt);
  if (isDue(c)) return c.status === 'MASTERED' ? 'Recheck due now' : 'Review due now';
  const prefix = c.status === 'MASTERED' ? 'Recheck' : 'Next review';
  const base = `${prefix} ${format(due, 'MMM d')}`;
  if (!withDistance) return base;
  return `${base} · in ${formatDistanceToNowStrict(due, { unit: 'day', roundingMethod: 'ceil' })}`;
}

/** "is due today" / "on Wed, Nov 6" for a freshly saved concept. */
export function firstReviewPhrase(nextRevisionAt: string) {
  const due = new Date(nextRevisionAt);
  return isBefore(due, endOfDay(new Date())) ? 'is due today' : `on ${format(due, 'EEE, MMM d')}`;
}

/** POST /api/concepts; throws with the server's message. */
export async function postConcept<T = { title: string; nextRevisionAt: string }>(body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api/concepts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Network error. Check your connection and try again.');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Could not save');
  return json as T;
}
