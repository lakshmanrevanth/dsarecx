// PATCH  /api/lists/[id] — rename { name }
// DELETE /api/lists/[id] — delete the list (its problems stay tracked)

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, currentUserId, jsonError, unauthorized, type IdContext } from '../../_shared/http';
import { isUniqueViolation, parseListName } from '../helpers';

export async function PATCH(request: NextRequest, { params }: IdContext) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const parsed = parseListName(body?.name);
    if ('error' in parsed) return badRequest(parsed.error);

    try {
      const { count } = await prisma.problemList.updateMany({ where: { id, userId }, data: { name: parsed.name } });
      if (count === 0) return jsonError('List not found', 404);
    } catch (e) {
      if (isUniqueViolation(e)) return jsonError('A list with that name already exists', 409);
      throw e;
    }
    return Response.json({ id, name: parsed.name });
  } catch (e) {
    console.error('[PATCH /api/lists/[id]]', e);
    return jsonError('Failed to rename list', 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: IdContext) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();
    const { id } = await params;

    const { count } = await prisma.problemList.deleteMany({ where: { id, userId } });
    if (count === 0) return jsonError('List not found', 404);
    return Response.json({ success: true });
  } catch (e) {
    console.error('[DELETE /api/lists/[id]]', e);
    return jsonError('Failed to delete list', 500);
  }
}
