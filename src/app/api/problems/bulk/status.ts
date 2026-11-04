import { addDays, getInitialSchedule, MASTERY_RECHECK_DAYS } from '@/lib/scheduling';

export const BULK_STATUSES = ['ACTIVE', 'MASTERED', 'RETIRED'] as const;
export type BulkStatus = (typeof BULK_STATUSES)[number];

/**
 * The fields to write when a problem's status changes; the same rules as
 * PATCH /api/problems/[id]. ACTIVE restarts the ladder (with the user's own
 * intervals), MASTERED schedules the long-term recheck, RETIRED only flips the status.
 */
export function statusUpdateData(status: BulkStatus, now: Date, ladder?: readonly number[]) {
  switch (status) {
    case 'ACTIVE': {
      const { currentStep, nextRevisionAt } = getInitialSchedule(now, ladder);
      return { status, currentStep, nextRevisionAt };
    }
    case 'MASTERED':
      return { status, currentStep: 3, nextRevisionAt: addDays(now, MASTERY_RECHECK_DAYS) };
    default:
      return { status };
  }
}
