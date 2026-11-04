// GET /api/daily/summary — everything the daily page needs in one request: the due queue,
// today's ratings, streak + goal, counts, the user's ladder and the next day with reviews.

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { dateKeyInTz, dayRangeInTz, getRequestTimeZone, TZ_COOKIE } from '@/lib/dates';
import { getUserPreferences } from '@/lib/preferences';
import { getDueProblems } from '@/app/api/problems/due/query';
import { getRevisedToday } from '@/app/api/problems/revised-today/query';
import { getStreakSummary } from '@/app/api/streak/compute';

const IN_ROTATION: ('ACTIVE' | 'MASTERED')[] = ['ACTIVE', 'MASTERED'];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const prefs = await getUserPreferences(userId);
    // The cookie follows the device; the saved timezone covers a request without one.
    const tz = request.cookies.get(TZ_COOKIE) ? getRequestTimeZone(request) : (prefs.timezone ?? 'UTC');
    const now = new Date();
    const { start, end } = dayRangeInTz(now, tz);

    // Order matters for the tests' mocks: revised-today queries revisions before the streak does.
    const [due, revisedToday, streak, total, mastered, nextAfterToday] = await Promise.all([
      getDueProblems(userId, start, end),
      getRevisedToday(userId, start, end),
      getStreakSummary(userId, tz, prefs, now),
      prisma.problem.count({ where: { userId } }),
      prisma.problem.count({ where: { userId, status: 'MASTERED' } }),
      prisma.problem.findFirst({
        where: { userId, status: { in: IN_ROTATION }, nextRevisionAt: { gt: end } },
        orderBy: { nextRevisionAt: 'asc' },
        select: { nextRevisionAt: true },
      }),
    ]);

    let upcoming: { date: string; count: number } | null = null;
    if (nextAfterToday) {
      const day = dayRangeInTz(nextAfterToday.nextRevisionAt, tz);
      const count = await prisma.problem.count({
        where: { userId, status: { in: IN_ROTATION }, nextRevisionAt: { gte: day.start, lte: day.end } },
      });
      upcoming = { date: dateKeyInTz(nextAfterToday.nextRevisionAt, tz), count: Math.max(1, count) };
    }

    return Response.json({
      today: dateKeyInTz(now, tz),
      due,
      revisedToday,
      streak,
      counts: { total, mastered },
      ladder: prefs.ladderDays,
      upcoming,
    });
  } catch (e) {
    console.error('[GET /api/daily/summary]', e);
    return Response.json({ error: 'Failed to load the daily summary' }, { status: 500 });
  }
}
