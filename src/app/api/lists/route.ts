// GET  /api/lists — the user's lists with counts and member problem ids
// POST /api/lists — create { name }

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NO_STORE_HEADERS, badRequest, currentUserId, jsonError, unauthorized } from '../_shared/http';
import { MAX_LISTS, isUniqueViolation, parseListName } from './helpers';

export async function GET(_request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const lists = await prisma.problemList.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, createdAt: true, problems: { select: { id: true } } },
    });
    const body = lists.map(({ problems, ...list }) => ({
      ...list,
      count: problems.length,
      problemIds: problems.map((p) => p.id),
    }));
    return Response.json(body, { headers: NO_STORE_HEADERS });
  } catch (e) {
    console.error('[GET /api/lists]', e);
    return jsonError('Failed to fetch lists', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => ({}));
    const parsed = parseListName(body?.name);
    if ('error' in parsed) return badRequest(parsed.error);

    if ((await prisma.problemList.count({ where: { userId } })) >= MAX_LISTS) {
      return badRequest(`You can have at most ${MAX_LISTS} lists`);
    }

    try {
      const list = await prisma.problemList.create({
        data: { userId, name: parsed.name },
        select: { id: true, name: true, createdAt: true },
      });
      return Response.json({ ...list, count: 0, problemIds: [] }, { status: 201 });
    } catch (e) {
      if (isUniqueViolation(e)) return jsonError('A list with that name already exists', 409);
      throw e;
    }
  } catch (e) {
    console.error('[POST /api/lists]', e);
    return jsonError('Failed to create list', 500);
  }
}
