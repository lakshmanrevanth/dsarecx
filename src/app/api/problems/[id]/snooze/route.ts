// POST /api/problems/[id]/snooze { days } — push a due problem to a later day without rating it

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestTimeZone, dayRangeInTz } from '@/lib/dates';
import { badRequest, currentUserId, jsonError, unauthorized, type IdContext } from '../../../_shared/http';
import { SNOOZE_DAYS, snoozeTarget } from './snooze';

export async function POST(request: NextRequest, { params }: IdContext) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const days = Number((await request.json().catch(() => null))?.days);
    if (!SNOOZE_DAYS.includes(days)) return badRequest(`days must be one of: ${SNOOZE_DAYS.join(', ')}`);

    const problem = await prisma.problem.findFirst({
      where: { id, userId },
      select: { id: true, status: true, nextRevisionAt: true },
    });
    if (!problem) return jsonError('Problem not found', 404);
    if (problem.status !== 'ACTIVE' && problem.status !== 'MASTERED') {
      return badRequest('Only problems in rotation can be snoozed.');
    }

    const now = new Date();
    const tz = getRequestTimeZone(request);
    // Snoozing must never pull a later review earlier.
    if (problem.nextRevisionAt > dayRangeInTz(now, tz).end) return jsonError('This problem is not due yet.', 409);

    const updated = await prisma.problem.update({
      where: { id },
      data: { nextRevisionAt: snoozeTarget(now, tz, days) },
    });
    return Response.json(updated);
  } catch (e) {
    console.error('[POST /api/problems/[id]/snooze]', e);
    return jsonError('Failed to snooze problem', 500);
  }
}
