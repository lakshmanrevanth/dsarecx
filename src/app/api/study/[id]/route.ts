// PATCH  /api/study/[id] — edit an item (only the fields sent)
// DELETE /api/study/[id] — remove an item (also used after "Learned it")

import type { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { dateKeyInTz, getRequestTimeZone } from '@/lib/dates';
import { dayKeyToDate, parseStudyInput, toStudyDto, withTargetFlags } from '@/lib/study';
import { badRequest, currentUserId, jsonError, unauthorized, type IdContext } from '../../_shared/http';

const notFound = () => jsonError('Item not found', 404);

export async function PATCH(request: NextRequest, { params }: IdContext) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();
    const { id } = await params;

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return badRequest('Invalid request body');
    const parsed = parseStudyInput(body as Record<string, unknown>, true);
    if ('error' in parsed) return badRequest(parsed.error);
    if (Object.keys(parsed.data).length === 0) return badRequest('Nothing to update');

    const existing = await prisma.studyItem.findFirst({ where: { id, userId }, select: { id: true, kind: true } });
    if (!existing) return notFound();

    const { targetDate, ...fields } = parsed.data;
    const data: Prisma.StudyItemUpdateInput = { ...fields };
    if (targetDate !== undefined) data.targetDate = targetDate ? dayKeyToDate(targetDate) : null;
    // System design items carry no coding-only fields.
    if ((fields.kind ?? existing.kind) === 'SYSTEM_DESIGN') {
      data.platform = null;
      data.identifier = null;
      data.difficulty = null;
    }

    const row = await prisma.studyItem.update({ where: { id }, data });
    const todayKey = dateKeyInTz(new Date(), getRequestTimeZone(request));
    return Response.json(withTargetFlags(toStudyDto(row), todayKey));
  } catch (e) {
    console.error('[PATCH /api/study/[id]]', e);
    return jsonError('Failed to update the item', 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: IdContext) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();
    const { id } = await params;

    const { count } = await prisma.studyItem.deleteMany({ where: { id, userId } });
    if (count === 0) return notFound();
    return Response.json({ success: true });
  } catch (e) {
    console.error('[DELETE /api/study/[id]]', e);
    return jsonError('Failed to delete the item', 500);
  }
}
