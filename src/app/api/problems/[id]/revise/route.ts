// PATCH /api/problems/[id]/revise — rate a review: { confidence, replaceLatest? }
//
// One rating per problem per (local) day. A second plain rating gets 409; to change
// today's rating the client sends replaceLatest, which re-scores today's revision
// from the step it started at instead of moving the problem up the ladder again.

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyRevision, type Confidence, type RevisionType } from '@/lib/scheduling';
import { getRequestTimeZone, dayRangeInTz, streakDateFor } from '@/lib/dates';
import { getUserPreferences } from '@/lib/preferences';
import { badRequest, currentUserId, jsonError, unauthorized, type IdContext } from '../../../_shared/http';

const CONFIDENCES: readonly string[] = ['CLEAN', 'SHAKY', 'STRUGGLED'];

const alreadyRevised = () =>
  jsonError('Already reviewed today. Change the rating from Completed today instead.', 409, {
    code: 'ALREADY_REVISED_TODAY',
  });

/** Thrown inside the transaction when another rating changed the problem first. */
class ConcurrentRevisionError extends Error {}

export async function PATCH(request: NextRequest, { params }: IdContext) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const { confidence, replaceLatest } = ((await request.json()) ?? {}) as {
      confidence?: Confidence;
      replaceLatest?: boolean;
    };
    if (!confidence || !CONFIDENCES.includes(confidence)) {
      return badRequest('confidence must be one of: CLEAN, SHAKY, STRUGGLED');
    }

    const problem = await prisma.problem.findFirst({
      where: { id, userId },
      select: {
        id: true,
        currentStep: true,
        status: true,
        nextRevisionAt: true,
        updatedAt: true,
        revisions: {
          orderBy: { revisedAt: 'desc' },
          take: 1,
          select: { id: true, type: true, stepBefore: true, revisedAt: true },
        },
      },
    });
    if (!problem) return jsonError('Problem not found', 404);

    const { ladderDays: ladder } = await getUserPreferences(userId);
    const now = new Date();
    const tz = getRequestTimeZone(request);
    const { start: todayStart } = dayRangeInTz(now, tz);
    const latest = problem.revisions[0];
    const latestIsToday = !!latest && latest.revisedAt >= todayStart;

    if (replaceLatest && !latestIsToday) return jsonError('You can only change a rating made today.', 409);
    // A second plain rating today (e.g. from a stale tab) would climb the ladder twice.
    if (!replaceLatest && latestIsToday) return alreadyRevised();
    if (problem.status === 'RETIRED') return badRequest('Retired problems cannot be reviewed.');

    // Change today's rating: re-score from where that review started.
    if (replaceLatest && latest) {
      const type = latest.type as RevisionType;
      const { newStep, newStatus, nextRevisionAt } = applyRevision({
        currentStep: latest.stepBefore,
        status: type === 'RECHECK' ? 'MASTERED' : 'ACTIVE',
        confidence,
        revisionType: type,
        today: latest.revisedAt,
        ladder,
      });
      const updated = await prisma.$transaction(async (tx) => {
        await tx.revision.update({ where: { id: latest.id }, data: { confidence, stepAfter: newStep } });
        return tx.problem.update({
          where: { id },
          data: { currentStep: newStep, status: newStatus, nextRevisionAt: nextRevisionAt ?? problem.nextRevisionAt },
        });
      });
      return Response.json({ ...updated, revisionId: latest.id });
    }

    const revisionType: RevisionType = problem.status === 'MASTERED' ? 'RECHECK' : 'REGULAR';
    const { newStep, newStatus, nextRevisionAt } = applyRevision({
      currentStep: problem.currentStep,
      status: problem.status,
      confidence,
      revisionType,
      today: now,
      ladder,
    });

    // Optimistic lock on updatedAt: two ratings sent at the same moment both pass the
    // same-day check above, so the second one must fail here instead of applying twice.
    let outcome: { updatedProblem: Record<string, unknown> | null; revisionId: string | null };
    try {
      outcome = await prisma.$transaction(async (tx) => {
        const { count } = await tx.problem.updateMany({
          where: { id, updatedAt: problem.updatedAt },
          data: {
            currentStep: newStep,
            status: newStatus,
            nextRevisionAt: nextRevisionAt ?? problem.nextRevisionAt,
            revisionCount: { increment: 1 },
          },
        });
        if (count === 0) throw new ConcurrentRevisionError();
        const revision = await tx.revision.create({
          data: { problemId: id, confidence, type: revisionType, stepBefore: problem.currentStep, stepAfter: newStep },
        });
        const updatedProblem = await tx.problem.findUnique({ where: { id } });
        return { updatedProblem, revisionId: revision?.id ?? null };
      });
    } catch (e) {
      if (e instanceof ConcurrentRevisionError) return alreadyRevised();
      throw e;
    }

    // Today's streak day is complete (the user's local day, not the server's).
    const date = streakDateFor(now, tz);
    await prisma.streakLog.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, completed: true },
      update: { completed: true },
    });

    // revisionId lets the client undo exactly this rating.
    return Response.json({ ...outcome.updatedProblem, revisionId: outcome.revisionId });
  } catch (e) {
    console.error('[PATCH /api/problems/[id]/revise]', e);
    return jsonError('Failed to submit revision', 500);
  }
}
