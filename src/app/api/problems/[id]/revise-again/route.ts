// PATCH /api/problems/[id]/revise-again — pull a MASTERED problem back into rotation

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reviseAgainFromMastered } from '@/lib/scheduling';
import { badRequest, currentUserId, jsonError, unauthorized, type IdContext } from '../../../_shared/http';

export async function PATCH(_request: NextRequest, { params }: IdContext) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const problem = await prisma.problem.findFirst({ where: { id, userId }, select: { id: true, status: true } });
    if (!problem) return jsonError('Problem not found', 404);
    if (problem.status !== 'MASTERED') {
      return badRequest('Only MASTERED problems can be pulled back into rotation.');
    }

    const { newStep, newStatus, nextRevisionAt } = reviseAgainFromMastered(new Date());
    const updated = await prisma.problem.update({
      where: { id },
      data: { currentStep: newStep, status: newStatus, nextRevisionAt },
    });
    return Response.json(updated);
  } catch (e) {
    console.error('[PATCH /api/problems/[id]/revise-again]', e);
    return jsonError('Failed to revise again', 500);
  }
}
