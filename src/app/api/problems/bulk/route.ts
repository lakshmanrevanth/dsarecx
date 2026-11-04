// POST /api/problems/bulk — { ids, action: 'status' | 'delete' | 'favorite', value }
// All or nothing: every id must belong to the user, checked inside the same transaction.

import type { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUserPreferences } from '@/lib/preferences';
import { parseIds } from '@/app/api/lists/helpers';
import { badRequest, currentUserId, jsonError, unauthorized } from '../../_shared/http';
import { BULK_STATUSES, statusUpdateData, type BulkStatus } from './status';

class NotOwnedError extends Error {}

export async function POST(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => ({}));
    const parsed = parseIds(body?.ids);
    if ('error' in parsed) return badRequest(parsed.error);
    const { ids } = parsed;
    const action = body?.action;

    // null means delete.
    let data: Prisma.ProblemUpdateManyMutationInput | null;
    switch (action) {
      case 'status': {
        const status = String(body?.value ?? '').toUpperCase();
        if (!(BULK_STATUSES as readonly string[]).includes(status)) {
          return badRequest('value must be ACTIVE, MASTERED or RETIRED');
        }
        const ladder = status === 'ACTIVE' ? (await getUserPreferences(userId)).ladderDays : undefined;
        data = statusUpdateData(status as BulkStatus, new Date(), ladder);
        break;
      }
      case 'favorite':
        if (typeof body?.value !== 'boolean') return badRequest('value must be a boolean');
        data = { isFavorite: body.value };
        break;
      case 'delete':
        data = null;
        break;
      default:
        return badRequest("action must be 'status', 'delete' or 'favorite'");
    }

    const where = { id: { in: ids }, userId };
    try {
      const count = await prisma.$transaction(async (tx) => {
        if ((await tx.problem.count({ where })) !== ids.length) throw new NotOwnedError();
        const result = data ? await tx.problem.updateMany({ where, data }) : await tx.problem.deleteMany({ where });
        return result.count;
      });
      return Response.json({ success: true, action, count });
    } catch (e) {
      if (e instanceof NotOwnedError) return jsonError('Some problems were not found', 404);
      throw e;
    }
  } catch (e) {
    console.error('[POST /api/problems/bulk]', e);
    return jsonError('Bulk update failed', 500);
  }
}
