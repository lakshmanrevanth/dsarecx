// Today's due and overdue problems, shared by /api/problems/due and /api/daily/summary.

import { prisma } from '@/lib/prisma';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * ACTIVE problems on the ladder plus MASTERED problems due for their long-term
 * recheck, with lateness and the last rating. Sorted weakest memory first:
 * lowest ladder step, then most overdue.
 */
export async function getDueProblems(userId: string, todayStart: Date, endOfToday: Date) {
  const problems = await prisma.problem.findMany({
    where: {
      userId,
      status: { in: ['ACTIVE', 'MASTERED'] },
      nextRevisionAt: { lte: endOfToday },
    },
    orderBy: { nextRevisionAt: 'asc' },
    include: {
      revisions: { orderBy: { revisedAt: 'desc' }, take: 1, select: { confidence: true, revisedAt: true } },
    },
  });

  return problems
    .map(({ revisions, ...problem }) => {
      const lateMs = todayStart.getTime() - problem.nextRevisionAt.getTime();
      const daysOverdue = lateMs > 0 ? Math.ceil(lateMs / DAY_MS) : 0;
      const last = revisions?.[0];
      return {
        ...problem,
        isOverdue: daysOverdue > 0,
        daysOverdue,
        isRecheck: problem.status === 'MASTERED',
        lastRating: last?.confidence ?? null,
        lastRevisedAt: last?.revisedAt ?? null,
      };
    })
    .sort((a, b) => a.currentStep - b.currentStep || b.daysOverdue - a.daysOverdue);
}
