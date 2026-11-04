// GET   /api/study            — the user's to-learn list, in order, with overdue target dates flagged
// POST  /api/study            — add an item: { kind, title, url?, platform?, identifier?, difficulty?, topic?, note?, targetDate? }
// PATCH /api/study { ids }    — reorder: every item id, in the new order
//
// Items are a plain backlog. "Learned it" on the Today page creates the Problem
// (POST /api/problems) or concept (POST /api/concepts) and then deletes the item.

import type { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { dateKeyInTz, getRequestTimeZone } from '@/lib/dates';
import { MAX_STUDY_ITEMS, dayKeyToDate, parseStudyInput, toStudyDto, withTargetFlags } from '@/lib/study';
import { NO_STORE_HEADERS, badRequest, currentUserId, jsonError, unauthorized } from '../_shared/http';

export async function GET(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const rows = await prisma.studyItem.findMany({
      where: { userId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    const todayKey = dateKeyInTz(new Date(), getRequestTimeZone(request));
    return Response.json(
      rows.map((r) => withTargetFlags(toStudyDto(r), todayKey)),
      { headers: NO_STORE_HEADERS }
    );
  } catch (e) {
    console.error('[GET /api/study]', e);
    return jsonError('Failed to load your to-learn list', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return badRequest('Invalid request body');
    const parsed = parseStudyInput(body as Record<string, unknown>, false);
    if ('error' in parsed) return badRequest(parsed.error);
    const { targetDate, ...fields } = parsed.data;

    const [count, last] = await Promise.all([
      prisma.studyItem.count({ where: { userId } }),
      prisma.studyItem.findFirst({ where: { userId }, orderBy: { order: 'desc' }, select: { order: true } }),
    ]);
    if (count >= MAX_STUDY_ITEMS) return badRequest(`Your to-learn list is full (${MAX_STUDY_ITEMS} items)`);

    const isDsa = fields.kind === 'DSA';
    const data: Prisma.StudyItemUncheckedCreateInput = {
      userId,
      kind: fields.kind!,
      title: fields.title!,
      url: fields.url ?? null,
      // Platform, identifier and difficulty only mean something for coding problems.
      platform: isDsa ? (fields.platform ?? null) : null,
      identifier: isDsa ? (fields.identifier ?? null) : null,
      difficulty: isDsa ? (fields.difficulty ?? null) : null,
      topic: fields.topic ?? null,
      note: fields.note ?? null,
      targetDate: targetDate ? dayKeyToDate(targetDate) : null,
      order: (last?.order ?? -1) + 1,
    };
    const row = await prisma.studyItem.create({ data });
    const todayKey = dateKeyInTz(new Date(), getRequestTimeZone(request));
    return Response.json(withTargetFlags(toStudyDto(row), todayKey), { status: 201 });
  } catch (e) {
    console.error('[POST /api/study]', e);
    return jsonError('Failed to add to your to-learn list', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    const ids: unknown = body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string')) {
      return badRequest('ids must be a non-empty array of item ids');
    }
    if (new Set(ids).size !== ids.length) return badRequest('ids must not repeat');

    const owned = await prisma.studyItem.findMany({ where: { userId }, select: { id: true } });
    const ownedIds = new Set(owned.map((o) => o.id));
    if (ids.length !== ownedIds.size || !ids.every((id) => ownedIds.has(id))) {
      return badRequest('ids must list every item in your to-learn list exactly once');
    }

    await prisma.$transaction(
      (ids as string[]).map((id, order) => prisma.studyItem.update({ where: { id }, data: { order } }))
    );
    return Response.json({ success: true });
  } catch (e) {
    console.error('[PATCH /api/study]', e);
    return jsonError('Failed to reorder your to-learn list', 500);
  }
}
