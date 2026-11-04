// GET /api/today — the Today page in one request, all in the user's local day:
//   learned      problems (DSA) and concepts (SYSTEM_DESIGN) solved or learned today
//   revisedCount problems rated today
//   due          how many reviews are due today, plus the first few (weakest first)
//   toLearn      the to-learn list, in order, with overdue target dates flagged
//   streak       current streak and today's goal progress
//
// "Learned today" goes by dateSolved (the day the user says they learned it), so a
// bulk import or backup restore of old problems doesn't show up as today's work.

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { dateKeyInTz, dayRangeInTz, getRequestTimeZone, TZ_COOKIE } from '@/lib/dates';
import { getUserPreferences } from '@/lib/preferences';
import { toStudyDto, withTargetFlags } from '@/lib/study';
import { getDueProblems } from '@/app/api/problems/due/query';
import { getRevisedToday } from '@/app/api/problems/revised-today/query';
import { getStreakSummary } from '@/app/api/streak/compute';
import { NO_STORE_HEADERS, currentUserId, jsonError, unauthorized } from '../_shared/http';

/** How many due titles the page previews. */
const DUE_PREVIEW = 5;
const MAX_LEARNED = 100;

const LEARNED_SELECT = {
  id: true,
  title: true,
  platform: true,
  difficulty: true,
  topic: true,
  url: true,
  code: true,
  problemNumber: true,
  dateSolved: true,
  createdAt: true,
} as const;

export async function GET(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const prefs = await getUserPreferences(userId);
    // The cookie follows the device; the saved timezone covers a request without one.
    const tz = request.cookies.get(TZ_COOKIE) ? getRequestTimeZone(request) : (prefs.timezone ?? 'UTC');
    const now = new Date();
    const { start, end } = dayRangeInTz(now, tz);
    const todayKey = dateKeyInTz(now, tz);

    const [learned, due, revisedToday, streak, studyRows] = await Promise.all([
      prisma.problem.findMany({
        where: { userId, dateSolved: { gte: start, lte: end } },
        select: LEARNED_SELECT,
        orderBy: { dateSolved: 'desc' },
        take: MAX_LEARNED,
      }),
      getDueProblems(userId, start, end),
      getRevisedToday(userId, start, end),
      getStreakSummary(userId, tz, prefs, now),
      prisma.studyItem.findMany({ where: { userId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
    ]);

    return Response.json(
      {
        today: todayKey,
        timezone: tz,
        learned: {
          dsa: learned.filter((p) => p.platform !== 'SYSTEM_DESIGN'),
          systemDesign: learned.filter((p) => p.platform === 'SYSTEM_DESIGN'),
        },
        revisedCount: revisedToday.length,
        due: {
          count: due.length,
          items: due.slice(0, DUE_PREVIEW).map((p) => ({
            id: p.id,
            title: p.title,
            platform: p.platform,
            difficulty: p.difficulty,
            topic: p.topic,
            isOverdue: p.isOverdue,
            daysOverdue: p.daysOverdue,
          })),
        },
        toLearn: studyRows.map((r) => withTargetFlags(toStudyDto(r), todayKey)),
        streak,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (e) {
    console.error('[GET /api/today]', e);
    return jsonError('Failed to load today', 500);
  }
}
