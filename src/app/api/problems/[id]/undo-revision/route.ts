// POST /api/problems/[id]/undo-revision { revisionId? } — undo today's latest rating
//
// Only a rating made today (the user's local day) can be undone. When the client
// sends the revisionId it got from /revise, the undo also refuses if that rating is
// no longer the latest, so a double click can't delete an older, legitimate revision.

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { revertRevision, type Confidence, type RevisionType } from '@/lib/scheduling';
import { getRequestTimeZone, dayRangeInTz, streakDateFor } from '@/lib/dates';
import { getUserPreferences } from '@/lib/preferences';
import { badRequest, currentUserId, jsonError, unauthorized, type IdContext } from '../../../_shared/http';

/** The optional revisionId; a missing or invalid body is fine (older clients send none). */
async function expectedRevisionId(request: NextRequest): Promise<string | undefined> {
  const body = await request.json().catch(() => null);
  return typeof body?.revisionId === 'string' ? body.revisionId : undefined;
}

export async function POST(request: NextRequest, { params }: IdContext) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const problem = await prisma.problem.findFirst({
      where: { id, userId },
      include: { revisions: { orderBy: { revisedAt: 'desc' }, take: 2 } },
    });
    if (!problem) return jsonError('Problem not found', 404);

    const [latest, prior = null] = problem.revisions;
    if (!latest) return badRequest('No revisions found to undo for this problem');

    const now = new Date();
    const tz = getRequestTimeZone(request);
    const { start: todayStart, end: todayEnd } = dayRangeInTz(now, tz);

    const expected = await expectedRevisionId(request);
    if (expected && expected !== latest.id) return jsonError('That rating was already undone.', 409);
    if (latest.revisedAt < todayStart) return jsonError('Only ratings made today can be undone.', 409);

    const { ladderDays: ladder } = await getUserPreferences(userId);
    const restored = revertRevision({
      currentProblem: { createdAt: problem.createdAt, revisionCount: problem.revisionCount },
      latestRevision: { stepBefore: latest.stepBefore, type: latest.type as RevisionType },
      priorRevision: prior && {
        stepBefore: prior.stepBefore,
        confidence: prior.confidence as Confidence,
        type: prior.type as RevisionType,
        revisedAt: prior.revisedAt,
      },
      ladder,
    });

    const updatedProblem = await prisma.$transaction(async (tx) => {
      await tx.revision.delete({ where: { id: latest.id } });
      return tx.problem.update({
        where: { id },
        data: {
          currentStep: restored.restoredStep,
          status: restored.restoredStatus,
          nextRevisionAt: restored.restoredNextRevisionAt,
          revisionCount: restored.restoredRevisionCount,
        },
      });
    });

    // If that was the user's only rating today, today no longer counts toward the streak.
    if (latest.revisedAt <= todayEnd) {
      const remainingToday = await prisma.revision.count({
        where: { problem: { userId }, revisedAt: { gte: todayStart, lte: todayEnd } },
      });
      if (remainingToday === 0) {
        const date = streakDateFor(now, tz);
        await prisma.streakLog.upsert({
          where: { userId_date: { userId, date } },
          create: { userId, date, completed: false },
          update: { completed: false },
        });
      }
    }

    return Response.json({ success: true, problem: updatedProblem });
  } catch (e) {
    console.error('[POST /api/problems/[id]/undo-revision]', e);
    return jsonError('Failed to undo revision', 500);
  }
}
