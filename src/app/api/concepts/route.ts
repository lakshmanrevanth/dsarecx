// GET  /api/concepts — the user's system design concepts with their review schedule
// POST /api/concepts — log a concept learned on a given day
//
// Concepts are problems with platform SYSTEM_DESIGN, so they share the review ladder,
// the daily queue, streaks, the heatmap and the Today page.
//
// POST body, one of:
//   { pathArticleId, notes?, learnedOn? }          a learning-path article (learned in order)
//   { slug, notes?, learnedOn?, url? }             a concept from the built-in library
//   { title, category, level?, notes?, url?, learnedOn? }   a concept of the user's own

import type { NextRequest } from 'next/server';
import type { Difficulty } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getInitialSchedule } from '@/lib/scheduling';
import { getUserPreferences } from '@/lib/preferences';
import { getRequestTimeZone, dateKeyInTz } from '@/lib/dates';
import { CONCEPT_CATEGORIES, buildConceptNotes, getConcept } from '@/lib/concepts/library';
import { getPathArticle, pathCode, previousArticle, promptsFor } from '@/lib/concepts/paths';
import { badRequest, currentUserId, isUniqueViolation, jsonError, unauthorized } from '../_shared/http';

const PLATFORM = 'SYSTEM_DESIGN' as const;
const LEVELS: readonly string[] = ['EASY', 'MEDIUM', 'HARD'];
const MAX_TITLE = 200;
const MAX_NOTES = 20000;

export async function GET() {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const concepts = await prisma.problem.findMany({
      where: { userId, platform: PLATFORM },
      orderBy: { dateSolved: 'desc' },
      include: {
        revisions: { orderBy: { revisedAt: 'desc' }, take: 1, select: { confidence: true, revisedAt: true } },
      },
    });
    return Response.json(concepts);
  } catch (e) {
    console.error('[GET /api/concepts]', e);
    return jsonError('Failed to load concepts', 500);
  }
}

/** A concept with this title already tracked (case-insensitive), if any. */
function findByTitle(userId: string, title: string) {
  return prisma.problem.findFirst({
    where: { userId, platform: PLATFORM, title: { equals: title, mode: 'insensitive' } },
    select: { id: true },
  });
}

function findByCode(userId: string, code: string) {
  return prisma.problem.findFirst({ where: { userId, platform: PLATFORM, code }, select: { id: true } });
}

export async function POST(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Invalid request');

    // Learning-path article: everything comes from the path data, and the server
    // enforces that articles are learned in order.
    const pathEntry = typeof body.pathArticleId === 'string' ? getPathArticle(body.pathArticleId) : undefined;
    if (body.pathArticleId && !pathEntry) return badRequest('Unknown path article');
    if (pathEntry) {
      const prev = previousArticle(pathEntry.article.id);
      if (prev && !(await findByCode(userId, pathCode(prev.id)))) {
        return jsonError(`Finish “${prev.title}” first — this path goes one article at a time.`, 409, {
          code: 'PATH_ORDER',
        });
      }
    }

    const concept = !pathEntry && typeof body.slug === 'string' ? getConcept(body.slug) : undefined;
    if (body.slug && !pathEntry && !concept) return badRequest('Unknown concept');

    let title = String(pathEntry?.article.title ?? body.title ?? concept?.title ?? '').trim();
    if (!title) return badRequest('Give the concept a name');
    if (title.length > MAX_TITLE) return badRequest(`Name must be at most ${MAX_TITLE} characters`);

    // Path articles are grouped under their path's name; everything else uses a library category.
    const category = pathEntry ? pathEntry.path.title : String(body.category ?? concept?.category ?? '').trim();
    if (!pathEntry && !(CONCEPT_CATEGORIES as readonly string[]).includes(category)) return badRequest('Pick a category');

    const level = String(pathEntry?.path.level ?? body.level ?? concept?.level ?? 'MEDIUM').toUpperCase();
    if (!LEVELS.includes(level)) return badRequest('Level must be EASY, MEDIUM or HARD');

    const url = pathEntry ? pathEntry.article.url : typeof body.url === 'string' ? body.url.trim() : '';
    if (url && !/^https?:\/\//i.test(url)) return badRequest('Link must start with http:// or https://');

    const userNotes = typeof body.notes === 'string' ? body.notes.slice(0, MAX_NOTES) : '';

    // The day it was learned in the user's timezone ("YYYY-MM-DD"); defaults to today.
    const now = new Date();
    const todayKey = dateKeyInTz(now, getRequestTimeZone(request));
    const learnedKey = typeof body.learnedOn === 'string' && body.learnedOn ? body.learnedOn : todayKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(learnedKey) || isNaN(Date.parse(learnedKey))) return badRequest('Invalid date');
    if (learnedKey > todayKey) return badRequest('The date learned cannot be in the future');
    // Noon UTC keeps the calendar day stable when shown in any timezone.
    const learnedAt = learnedKey === todayKey ? now : new Date(`${learnedKey}T12:00:00Z`);

    if (pathEntry) {
      // Path articles are identified by their code, so the path can always move on.
      const already = await findByCode(userId, pathCode(pathEntry.article.id));
      if (already) return jsonError('Already learned.', 409, { existingId: already.id });
      // A hand-added concept with the same title: keep both by naming the path one.
      if (await findByTitle(userId, title)) title = `${title} (${pathEntry.path.title})`;
    } else {
      const existing = await findByTitle(userId, title);
      if (existing) return jsonError('Already tracked.', 409, { existingId: existing.id });
    }

    const notes =
      (pathEntry
        ? buildConceptNotes(userNotes, {
            slug: pathEntry.article.id,
            title,
            category,
            level: level as Difficulty,
            summary: pathEntry.article.summary,
            prompts: promptsFor(pathEntry.article),
          })
        : buildConceptNotes(userNotes, concept)) || null;

    // The first review follows the user's ladder from the day it was learned;
    // if that day has already passed, the concept is due now.
    const { ladderDays } = await getUserPreferences(userId);
    const schedule = getInitialSchedule(learnedAt, ladderDays);
    const nextRevisionAt = schedule.nextRevisionAt < now ? now : schedule.nextRevisionAt;

    const create = async () => {
      const last = await prisma.problem.findFirst({
        where: { userId, platform: PLATFORM },
        orderBy: { problemNumber: 'desc' },
        select: { problemNumber: true },
      });
      return prisma.problem.create({
        data: {
          userId,
          platform: PLATFORM,
          problemNumber: (last?.problemNumber ?? 0) + 1,
          code: pathEntry ? pathCode(pathEntry.article.id) : concept?.slug ?? null,
          title,
          url,
          difficulty: level as Difficulty,
          topic: category,
          tags: pathEntry ? ['system-design', pathEntry.path.slug] : ['system-design'],
          notes,
          dateSolved: learnedAt,
          status: 'ACTIVE',
          currentStep: schedule.currentStep,
          nextRevisionAt,
        },
      });
    };

    try {
      return Response.json(await create(), { status: 201 });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      // Same code already stored (e.g. "Mark as learned" double-clicked): already learned.
      const target = (e as { meta?: { target?: unknown } }).meta?.target;
      if (String(target ?? '').includes('code')) return jsonError('Already learned.', 409);
      // Two concepts added at the same moment raced for the same number: retry once.
      return Response.json(await create(), { status: 201 });
    }
  } catch (e) {
    console.error('[POST /api/concepts]', e);
    return jsonError('Failed to save concept', 500);
  }
}
