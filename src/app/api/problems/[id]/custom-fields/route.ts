// PATCH /api/problems/[id]/custom-fields — merge values into the problem's customFields JSON.
// Body: { key, value } for one field, or an object of { name: value } pairs.

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserId, jsonError, unauthorized, type IdContext } from '../../../_shared/http';

type Fields = Record<string, string>;

function merge(current: Fields, body: unknown): Fields {
  if (body && typeof body === 'object' && 'key' in body && 'value' in body) {
    const { key, value } = body as { key: string; value: string };
    return { ...current, [key]: value };
  }
  return { ...current, ...(body as Fields) };
}

export async function PATCH(request: NextRequest, { params }: IdContext) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const body = await request.json();

    // Read-modify-write inside one transaction so concurrent edits don't drop each other.
    const customFields = await prisma.$transaction(async (tx) => {
      const existing = await tx.problem.findFirst({ where: { id, userId }, select: { customFields: true } });
      if (!existing) return null;
      const merged = merge((existing.customFields as Fields) ?? {}, body);
      await tx.problem.update({ where: { id }, data: { customFields: merged } });
      return merged;
    });

    if (customFields === null) return jsonError('Problem not found', 404);
    return Response.json({ success: true, id, customFields });
  } catch (e) {
    console.error('[PATCH /api/problems/[id]/custom-fields]', e);
    return jsonError('Failed to update custom fields', 500);
  }
}
