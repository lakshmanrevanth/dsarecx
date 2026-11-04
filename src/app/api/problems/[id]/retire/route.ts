// PATCH /api/problems/[id]/retire — take a problem out of rotation

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { retireProblem } from '@/lib/scheduling';
import { currentUserId, jsonError, unauthorized, type IdContext } from '../../../_shared/http';

export async function PATCH(_request: NextRequest, { params }: IdContext) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const problem = await prisma.problem.findFirst({ where: { id, userId }, select: { id: true } });
    if (!problem) return jsonError('Problem not found', 404);

    const { newStatus } = retireProblem();
    const updated = await prisma.problem.update({ where: { id }, data: { status: newStatus } });
    return Response.json(updated);
  } catch (e) {
    console.error('[PATCH /api/problems/[id]/retire]', e);
    return jsonError('Failed to retire problem', 500);
  }
}
