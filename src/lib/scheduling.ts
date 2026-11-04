// =============================================================================
// scheduling.ts — the spaced repetition engine.
//
// Every tracked item climbs a ladder of review intervals (3 → 7 → 14 → 30 days
// by default; each user can set their own four). How the user rates a review
// decides the next step:
//
//   REGULAR review (ACTIVE items)
//     CLEAN      → next step; at the top step the item becomes MASTERED and
//                  comes back once for a long-term recheck after 90 days.
//     SHAKY      → repeat the current interval.
//     STRUGGLED  → back to step 0.
//
//   RECHECK review (MASTERED items pulled back)
//     CLEAN      → step 3     SHAKY → step 1     STRUGGLED → step 0
//
// Everything here is pure: plain data in, plain data out. No database, no
// framework, no clock reads. That keeps the engine trivially testable.
// =============================================================================

/** Default review intervals, in days, for steps 0..3. */
export const LADDER_DAYS = [3, 7, 14, 30] as const;

/** Four positive, strictly increasing day counts. */
export type Ladder = readonly [number, number, number, number];

/** Days until a MASTERED item comes back for its long-term recheck. */
export const MASTERY_RECHECK_DAYS = 90;

export type LadderStep = 0 | 1 | 2 | 3;
export type ProblemStatus = 'ACTIVE' | 'MASTERED' | 'RETIRED';
export type Confidence = 'CLEAN' | 'SHAKY' | 'STRUGGLED';
export type RevisionType = 'REGULAR' | 'RECHECK';

export type SchedulingInput = {
  /** Current ladder step (0–3). */
  currentStep: number;
  status: ProblemStatus;
  confidence: Confidence;
  revisionType: RevisionType;
  /** When the review happened; the next due date is measured from here. */
  today: Date;
  /** The user's intervals; invalid or missing values fall back to LADDER_DAYS. */
  ladder?: readonly number[];
};

export type SchedulingResult = {
  newStep: number;
  newStatus: ProblemStatus;
  /** null means no further review is scheduled. */
  nextRevisionAt: Date | null;
};

const MAX_INTERVAL_DAYS = 365;

/** Returns the user's ladder when it is valid, else the default ladder. */
export function normalizeLadder(input: readonly number[] | null | undefined): Ladder {
  if (!Array.isArray(input) || input.length !== 4) return LADDER_DAYS;
  const valid = input.every(
    (n, i) => Number.isInteger(n) && n >= 1 && n <= MAX_INTERVAL_DAYS && (i === 0 || n > input[i - 1])
  );
  return valid ? [input[0], input[1], input[2], input[3]] : LADDER_DAYS;
}

/** A new Date `days` calendar days after `date` (never mutates the input). */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function clampStep(step: number): LadderStep {
  if (!Number.isFinite(step) || step <= 0) return 0;
  if (step >= 3) return 3;
  return Math.floor(step) as LadderStep;
}

function activeAt(step: LadderStep, today: Date, ladder: Ladder): SchedulingResult {
  return { newStep: step, newStatus: 'ACTIVE', nextRevisionAt: addDays(today, ladder[step]) };
}

/** Computes the item's next state after one review. */
export function applyRevision(input: SchedulingInput): SchedulingResult {
  const { confidence, revisionType, today } = input;
  const ladder = normalizeLadder(input.ladder);

  if (revisionType === 'RECHECK') {
    const step: LadderStep = confidence === 'CLEAN' ? 3 : confidence === 'SHAKY' ? 1 : 0;
    return activeAt(step, today, ladder);
  }

  if (confidence === 'STRUGGLED') return activeAt(0, today, ladder);

  const step = clampStep(input.currentStep);
  if (confidence === 'SHAKY') {
    // Keep the caller's step value as-is (it is already a valid ladder step in practice).
    return { ...activeAt(step, today, ladder), newStep: input.currentStep };
  }

  // CLEAN
  if (step === 3) {
    return { newStep: 3, newStatus: 'MASTERED', nextRevisionAt: addDays(today, MASTERY_RECHECK_DAYS) };
  }
  return activeAt((step + 1) as LadderStep, today, ladder);
}

/** Manually removing an item from rotation. */
export function retireProblem(): Pick<SchedulingResult, 'newStatus' | 'nextRevisionAt'> {
  return { newStatus: 'RETIRED', nextRevisionAt: null };
}

/**
 * "Revise again" on a mastered item: it stays MASTERED but is due now, so the
 * next rating is scored with the RECHECK rules.
 */
export function reviseAgainFromMastered(today: Date): {
  newStep: 3;
  newStatus: 'MASTERED';
  nextRevisionAt: Date;
  revisionType: 'RECHECK';
} {
  return { newStep: 3, newStatus: 'MASTERED', nextRevisionAt: today, revisionType: 'RECHECK' };
}

/** The schedule for a newly added item: step 0, first review after ladder[0] days. */
export function getInitialSchedule(createdAt: Date, ladderInput?: readonly number[]): {
  currentStep: 0;
  nextRevisionAt: Date;
  status: 'ACTIVE';
} {
  return {
    currentStep: 0,
    nextRevisionAt: addDays(createdAt, normalizeLadder(ladderInput)[0]),
    status: 'ACTIVE',
  };
}

/** True when the item is due on `today`'s calendar day or is overdue. */
export function isDueToday(nextRevisionAt: Date, today: Date): boolean {
  const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return dayOf(nextRevisionAt) <= dayOf(today);
}

export type RevertRevisionInput = {
  currentProblem: {
    createdAt: Date;
    revisionCount: number;
  };
  latestRevision: {
    stepBefore: number;
    type: RevisionType;
  };
  priorRevision?: {
    stepBefore: number;
    confidence: Confidence;
    type: RevisionType;
    revisedAt: Date;
  } | null;
  ladder?: readonly number[];
};

export type RevertRevisionResult = {
  restoredStep: number;
  restoredStatus: ProblemStatus;
  restoredNextRevisionAt: Date;
  restoredRevisionCount: number;
};

/**
 * Undoes the latest review: restores the step and status from before it, and
 * recomputes the due date the item had at that point (from the review before,
 * or from the initial schedule when there was none).
 */
export function revertRevision(input: RevertRevisionInput): RevertRevisionResult {
  const { currentProblem, latestRevision, priorRevision, ladder } = input;

  let restoredNextRevisionAt: Date;
  if (priorRevision) {
    const prior = applyRevision({
      currentStep: priorRevision.stepBefore,
      status: priorRevision.type === 'RECHECK' ? 'MASTERED' : 'ACTIVE',
      confidence: priorRevision.confidence,
      revisionType: priorRevision.type,
      today: priorRevision.revisedAt,
      ladder,
    });
    restoredNextRevisionAt = prior.nextRevisionAt ?? priorRevision.revisedAt;
  } else {
    restoredNextRevisionAt = getInitialSchedule(currentProblem.createdAt, ladder).nextRevisionAt;
  }

  return {
    restoredStep: latestRevision.stepBefore,
    restoredStatus: latestRevision.type === 'RECHECK' ? 'MASTERED' : 'ACTIVE',
    restoredNextRevisionAt,
    restoredRevisionCount: Math.max(0, currentProblem.revisionCount - 1),
  };
}
