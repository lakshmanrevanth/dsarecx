// PATCH  /api/problems/[id] — partial update: isFavorite, notes, topic, difficulty, status,
//                             title, url, tags, dateSolved, platform, problemNumber, code,
//                             nextRevisionOn ("YYYY-MM-DD", the user's local day)
// DELETE /api/problems/[id] — delete one problem

import type { NextRequest } from 'next/server';
import type { Platform, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUserPreferences } from '@/lib/preferences';
import { dateKeyInTz, getRequestTimeZone, shiftDateKey, startOfDayKeyInTz } from '@/lib/dates';
import {
  MAX_TITLE_LENGTH,
  codeforcesNumericId,
  initialScheduleFor,
  isHttpUrl,
  normalizeCode,
  normalizeTags,
  parseSolvedDate,
} from '@/lib/platforms/problem-input';
import { statusUpdateData, type BulkStatus } from '../bulk/status';
import {
  badRequest,
  currentUserId,
  isUniqueViolation,
  jsonError,
  unauthorized,
  type IdContext,
} from '../../_shared/http';

const PLATFORMS = ['LEETCODE', 'CODEFORCES', 'GFG', 'HACKERRANK', 'CODECHEF'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
const STATUSES = ['ACTIVE', 'MASTERED', 'RETIRED'];
/** Bodies with only these keys are updated in a single ownership-scoped query. */
const SIMPLE_FIELDS = new Set(['isFavorite', 'notes', 'topic', 'difficulty', 'status']);
const MAX_PROBLEM_NUMBER = 2_000_000_000;
const MAX_RESCHEDULE_DAYS = 3 * 366;

type Data = Record<string, unknown>;
type Parsed = { data: Data; newSolvedAt: Date | null; nextRevisionOn: string | null } | { error: string };

/** Validates the body field by field. Needs the ladder only when the status becomes ACTIVE. */
async function parseBody(
  body: Record<string, unknown>,
  request: NextRequest,
  getLadder: () => Promise<readonly number[]>
): Promise<Parsed> {
  const data: Data = {};
  const has = (k: string) => k in body;

  if (has('isFavorite')) data.isFavorite = Boolean(body.isFavorite);
  if (has('notes')) data.notes = body.notes == null ? null : String(body.notes);
  if (has('topic')) data.topic = String(body.topic ?? '').trim();
  if (has('difficulty')) {
    const d = String(body.difficulty).toUpperCase();
    if (!DIFFICULTIES.includes(d)) return { error: 'difficulty must be EASY, MEDIUM, or HARD' };
    data.difficulty = d;
  }
  if (has('title')) {
    const t = typeof body.title === 'string' ? body.title.trim() : '';
    if (!t) return { error: 'title cannot be empty' };
    if (t.length > MAX_TITLE_LENGTH) return { error: `title must be at most ${MAX_TITLE_LENGTH} characters` };
    data.title = t;
  }
  if (has('url')) {
    if (!isHttpUrl(body.url)) return { error: 'url must start with http:// or https://' };
    data.url = (body.url as string).trim();
  }
  if (has('tags')) {
    const parsed = normalizeTags(body.tags);
    if ('error' in parsed) return parsed;
    data.tags = parsed.tags;
  }
  let newSolvedAt: Date | null = null;
  if (has('dateSolved')) {
    const parsed = parseSolvedDate(body.dateSolved);
    if ('error' in parsed) return parsed;
    newSolvedAt = data.dateSolved = parsed.date;
  }
  if (has('platform')) {
    const p = String(body.platform).toUpperCase();
    if (!PLATFORMS.includes(p)) return { error: 'Unknown platform' };
    data.platform = p;
  }
  if (has('code')) {
    if (body.code == null || body.code === '') {
      data.code = null;
    } else {
      const c = normalizeCode(body.code);
      if (!c) return { error: 'code must be a short identifier like 1234A' };
      data.code = c;
    }
  }
  if (has('problemNumber')) {
    const n = Number(body.problemNumber);
    if (!Number.isInteger(n) || n <= 0 || n > MAX_PROBLEM_NUMBER) {
      return { error: 'problemNumber must be a positive whole number' };
    }
    data.problemNumber = n;
  }
  if (has('status')) {
    // Unknown statuses are ignored. A known one also moves the schedule, so a problem
    // imported as archived (due 2099) and then made Active really comes due.
    const s = String(body.status).toUpperCase();
    if (STATUSES.includes(s)) {
      const ladder = s === 'ACTIVE' ? await getLadder() : undefined;
      Object.assign(data, statusUpdateData(s as BulkStatus, new Date(), ladder));
    }
  }

  // Move the next review to a calendar day. No revision is logged; the ladder step stays.
  let nextRevisionOn: string | null = null;
  if (has('nextRevisionOn')) {
    const key = typeof body.nextRevisionOn === 'string' ? body.nextRevisionOn : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || isNaN(Date.parse(`${key}T00:00:00Z`))) {
      return { error: 'nextRevisionOn must be a date like 2026-11-20' };
    }
    const todayKey = dateKeyInTz(new Date(), getRequestTimeZone(request));
    if (key < todayKey) return { error: "The next review can't be in the past" };
    if (key > shiftDateKey(todayKey, MAX_RESCHEDULE_DAYS)) return { error: 'The next review must be within 3 years' };
    nextRevisionOn = key;
  }

  return { data, newSolvedAt, nextRevisionOn };
}

export async function PATCH(request: NextRequest, { params }: IdContext) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    const body = await request.json();
    if (!body || typeof body !== 'object') return badRequest('No updatable fields provided');

    let ladder: readonly number[] | undefined;
    const getLadder = async () => (ladder ??= (await getUserPreferences(userId)).ladderDays);

    const parsed = await parseBody(body, request, getLadder);
    if ('error' in parsed) return badRequest(parsed.error);
    const { data, newSolvedAt, nextRevisionOn } = parsed;

    if (Object.keys(data).length === 0 && !nextRevisionOn) return badRequest('No updatable fields provided');

    // Fast path: simple fields need no read first. Ownership is part of the where clause.
    if (Object.keys(body).every((k) => SIMPLE_FIELDS.has(k))) {
      const { count } = await prisma.problem.updateMany({ where: { id, userId }, data });
      if (count === 0) return jsonError('Problem not found', 404);
      return Response.json({ success: true, id });
    }

    const existing = await prisma.problem.findFirst({
      where: { id, userId },
      select: { id: true, platform: true, problemNumber: true, revisionCount: true, status: true },
    });
    if (!existing) return jsonError('Problem not found', 404);

    // Codeforces: a new code implies a new number, unless one was given explicitly.
    const platform = (data.platform as string | undefined) ?? existing.platform;
    if (platform === 'CODEFORCES' && typeof data.code === 'string' && !('problemNumber' in data)) {
      const n = codeforcesNumericId(data.code);
      if (n) data.problemNumber = n;
    }

    const problemNumber = (data.problemNumber as number | undefined) ?? existing.problemNumber;
    if (platform !== existing.platform || problemNumber !== existing.problemNumber) {
      const clash = await prisma.problem.findFirst({
        where: { userId, platform: platform as Platform, problemNumber, NOT: { id } },
        select: { id: true },
      });
      if (clash) return jsonError('Already tracked.', 409, { existingId: clash.id });
    }

    // A new solve date moves the first review, but only while nothing has been reviewed.
    if (newSolvedAt && existing.revisionCount === 0 && !('status' in data) && existing.status === 'ACTIVE') {
      const schedule = initialScheduleFor(newSolvedAt, await getLadder());
      data.currentStep = schedule.currentStep;
      data.nextRevisionAt = schedule.nextRevisionAt;
    }

    if (nextRevisionOn) {
      const finalStatus = (data.status as string | undefined) ?? existing.status;
      if (finalStatus === 'RETIRED') return badRequest('Retired problems have no next review. Make it Active first.');
      data.nextRevisionAt = startOfDayKeyInTz(nextRevisionOn, getRequestTimeZone(request));
    }

    try {
      const problem = await prisma.problem.update({ where: { id }, data: data as Prisma.ProblemUpdateInput });
      return Response.json({ success: true, id, problem });
    } catch (e) {
      if (isUniqueViolation(e)) return jsonError('Already tracked.', 409);
      throw e;
    }
  } catch (e) {
    console.error('[PATCH /api/problems/[id]]', e);
    return jsonError('Failed to update problem', 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: IdContext) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const { id } = await params;
    // One query: ownership check and delete together.
    const { count } = await prisma.problem.deleteMany({ where: { id, userId } });
    if (count === 0) return jsonError('Problem not found', 404);
    return Response.json({ success: true, message: 'Problem deleted' });
  } catch (e) {
    console.error('[DELETE /api/problems/[id]]', e);
    return jsonError('Failed to delete problem', 500);
  }
}
