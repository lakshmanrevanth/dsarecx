// GET    /api/problems            — the user's problems (optional ?status=, ?topic=), newest first
// POST   /api/problems            — track a coding problem (metadata resolved from the datasets)
// DELETE /api/problems { ids }    — delete several problems

import type { NextRequest } from 'next/server';
import type { Difficulty, Platform, ProblemStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getResolver } from '@/lib/platforms';
import { getUserPreferences } from '@/lib/preferences';
import type { ProblemMeta } from '@/lib/platforms/types';
import {
  MAX_TITLE_LENGTH,
  codeforcesNumericId,
  hashToProblemNumber,
  initialScheduleFor,
  isHttpUrl,
  normalizeCode,
  normalizeTags,
  parseSolvedDate,
} from '@/lib/platforms/problem-input';
import { NO_STORE_HEADERS, badRequest, currentUserId, isUniqueViolation, jsonError, unauthorized } from '../_shared/http';

const STATUSES = ['ACTIVE', 'MASTERED', 'RETIRED'];
/** Coding platforms only; system design concepts go through /api/concepts. */
const CODING_PLATFORMS = ['LEETCODE', 'CODEFORCES', 'GFG', 'HACKERRANK', 'CODECHEF'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

export async function GET(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const params = request.nextUrl.searchParams;
    const status = params.get('status')?.toUpperCase() || undefined;
    if (status && !STATUSES.includes(status)) {
      return badRequest('status must be ACTIVE, MASTERED or RETIRED');
    }
    const topic = params.get('topic') ?? undefined;

    // No server-side cache: SWR caches on the client, and caching twice made
    // fresh mutations look lost.
    const problems = await prisma.problem.findMany({
      where: {
        userId,
        ...(status ? { status: status as ProblemStatus } : {}),
        ...(topic ? { topic } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { revisions: { orderBy: { revisedAt: 'desc' }, take: 1 } },
    });
    return Response.json(problems, { headers: NO_STORE_HEADERS });
  } catch (e) {
    console.error('[GET /api/problems]', e);
    return jsonError('Failed to fetch problems', 500);
  }
}

/** The number a problem is stored under: dataset number, typed number, Codeforces id, or a stable hash. */
function pickProblemNumber(
  platform: string,
  resolved: ProblemMeta | null,
  typed: unknown,
  code: string | null,
  url: string
): number {
  if (typeof resolved?.problemNumber === 'number' && resolved.problemNumber > 0) return resolved.problemNumber;

  const typedText = String(typed ?? '').trim();
  let n = /^\d+$/.test(typedText) ? parseInt(typedText, 10) : 0;
  if (n <= 0 && platform === 'CODEFORCES' && code) n = codeforcesNumericId(code) ?? 0;
  if (n > 0) return n;

  // No natural number: hash the LeetCode slug (kept for backwards compatibility),
  // else the code or URL, so manual entries never collide on 0.
  const slug = platform === 'LEETCODE' ? url.match(/leetcode\.com\/problems\/([^/?#]+)/)?.[1] : undefined;
  return hashToProblemNumber(slug ?? (code || url.replace(/\/+$/, '').toLowerCase()));
}

export async function POST(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const body = (await request.json()) ?? {};
    const { platform, problemNumber, notes, dateSolved, customFields } = body;

    if (!platform || typeof platform !== 'string') return badRequest('platform is required');
    if (!CODING_PLATFORMS.includes(platform)) return badRequest('Unknown platform');

    const now = new Date();
    let solvedAt = now;
    if (dateSolved != null && dateSolved !== '') {
      const parsed = parseSolvedDate(dateSolved, now);
      if ('error' in parsed) return badRequest(parsed.error);
      solvedAt = parsed.date;
    }

    let tags: string[] = [];
    if (body.tags != null) {
      const parsed = normalizeTags(body.tags);
      if ('error' in parsed) return badRequest(parsed.error);
      tags = parsed.tags;
    }

    const manualTitle = typeof body.title === 'string' ? body.title.trim() : '';
    const manualUrl = typeof body.url === 'string' ? body.url.trim() : '';
    if (manualUrl && !isHttpUrl(manualUrl)) return badRequest('url must start with http:// or https://');
    if (manualTitle.length > MAX_TITLE_LENGTH) {
      return badRequest(`title must be at most ${MAX_TITLE_LENGTH} characters`);
    }

    // Look the problem up when we have an identifier. Values the client sent
    // (title, difficulty, topic, url) win over the looked-up ones.
    const resolver = getResolver(platform);
    const identifier = String(body.code || problemNumber || '').trim();
    let resolved: ProblemMeta | null = null;
    if (resolver && identifier && identifier !== '0') {
      const result = await resolver.resolve(identifier);
      if (result.found) resolved = result.data;
    }

    const title = manualTitle || resolved?.title || '';
    const url = manualUrl || resolved?.url || '';
    const difficulty = String(body.difficulty || resolved?.difficulty || '').toUpperCase();
    let topic = typeof body.topic === 'string' ? body.topic.trim() : resolved?.topic ?? '';
    if (topic === 'General') topic = '';

    if (!title || !url) {
      return jsonError('Problem not found. Provide title, difficulty, and url manually.', 422);
    }
    if (!DIFFICULTIES.includes(difficulty)) {
      return badRequest('difficulty is required and must be EASY, MEDIUM, or HARD');
    }

    const code =
      normalizeCode(resolved?.code) ??
      normalizeCode(body.code) ??
      (platform !== 'LEETCODE' ? normalizeCode(problemNumber) : null);
    const number = pickProblemNumber(platform, resolved, problemNumber, code, url);

    const { ladderDays } = await getUserPreferences(userId);
    const schedule = initialScheduleFor(solvedAt, ladderDays, now);

    try {
      const problem = await prisma.problem.create({
        data: {
          userId,
          platform: platform as Platform,
          problemNumber: number,
          code,
          title,
          url,
          difficulty: difficulty as Difficulty,
          topic,
          tags,
          dateSolved: solvedAt,
          notes: typeof notes === 'string' && notes.trim() ? notes : null,
          customFields: customFields ?? {},
          currentStep: schedule.currentStep,
          nextRevisionAt: schedule.nextRevisionAt,
          status: schedule.status,
        },
      });
      return Response.json(problem, { status: 201 });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const existing = await prisma.problem.findFirst({
        where: { userId, platform: platform as Platform, problemNumber: number },
        select: { id: true, title: true },
      });
      return jsonError('Already tracked.', 409, {
        existingId: existing?.id ?? null,
        existingTitle: existing?.title ?? null,
      });
    }
  } catch (e) {
    console.error('[POST /api/problems]', e);
    return jsonError('Failed to create problem', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const { ids } = (await request.json()) ?? {};
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === 'string')) {
      return badRequest('ids array is required');
    }

    const { count } = await prisma.problem.deleteMany({ where: { id: { in: ids }, userId } });
    return Response.json({ count, message: `Successfully deleted ${count} problems` });
  } catch (e) {
    console.error('[DELETE /api/problems]', e);
    return jsonError('Failed to delete problems', 500);
  }
}
