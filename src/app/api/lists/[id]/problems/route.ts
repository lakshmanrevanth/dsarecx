// POST /api/lists/[id]/problems — { problemIds, action: 'add' | 'remove' }
// Only the user's own list and own problems are touched; other ids are ignored.

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, currentUserId, jsonError, unauthorized, type IdContext } from '../../../_shared/http';
import { parseIds } from '../../helpers';

export async function POST(request: NextRequest, { params }: IdContext) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const action = body?.action;
    if (action !== 'add' && action !== 'remove') return badRequest("action must be 'add' or 'remove'");
    const parsed = parseIds(body?.problemIds);
    if ('error' in parsed) return badRequest(parsed.error.replace('ids', 'problemIds'));

    const list = await prisma.problemList.findFirst({ where: { id, userId }, select: { id: true } });
    if (!list) return jsonError('List not found', 404);

    const owned = await prisma.problem.findMany({ where: { id: { in: parsed.ids }, userId }, select: { id: true } });
    if (owned.length === 0) return jsonError('No matching problems', 404);

    const refs = owned.map(({ id: problemId }) => ({ id: problemId }));
    const { problems } = await prisma.problemList.update({
      where: { id: list.id },
      data: { problems: action === 'add' ? { connect: refs } : { disconnect: refs } },
      select: { problems: { select: { id: true } } },
    });

    return Response.json({
      id: list.id,
      action,
      changed: owned.length,
      count: problems.length,
      problemIds: problems.map((p) => p.id),
    });
  } catch (e) {
    console.error('[POST /api/lists/[id]/problems]', e);
    return jsonError('Failed to update list', 500);
  }
}
