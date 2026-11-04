// Problems rated today with their latest rating, shared by
// /api/problems/revised-today and /api/daily/summary.

import { prisma } from '@/lib/prisma';

export type RevisedTodayItem = Record<string, unknown> & {
  id: string;
  latestRevision: {
    id: string;
    confidence: string;
    type: string;
    stepBefore: number;
    stepAfter: number;
    revisedAt: Date;
  };
};

export async function getRevisedToday(userId: string, todayStart: Date, endOfToday: Date): Promise<RevisedTodayItem[]> {
  const revisions = await prisma.revision.findMany({
    where: { problem: { userId }, revisedAt: { gte: todayStart, lte: endOfToday } },
    include: { problem: true },
    orderBy: { revisedAt: 'desc' },
  });

  // Newest first, so the first revision seen for a problem is its latest.
  const byProblem = new Map<string, RevisedTodayItem>();
  for (const { id, problemId, confidence, type, stepBefore, stepAfter, revisedAt, problem } of revisions) {
    if (byProblem.has(problemId)) continue;
    byProblem.set(problemId, {
      ...problem,
      latestRevision: { id, confidence, type, stepBefore, stepAfter, revisedAt },
    });
  }
  return [...byProblem.values()];
}
