// GET /api/activity — reviews per local day over the last year, for the heatmap.
// Returns [{ date: "YYYY-MM-DD", count }] sorted by date.

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { dateKeyInTz, getRequestTimeZone } from '@/lib/dates';

const DAY_MS = 24 * 60 * 60 * 1000;
/** One extra day so the oldest heatmap cell is complete in every timezone. */
const LOOKBACK_DAYS = 366;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const tz = getRequestTimeZone(request);

    const since = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS);
    const revisions = await prisma.revision.findMany({
      where: { problem: { userId }, revisedAt: { gte: since } },
      select: { revisedAt: true },
    });

    const counts = new Map<string, number>();
    for (const { revisedAt } of revisions) {
      const date = dateKeyInTz(revisedAt, tz);
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }

    const days = [...counts]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return Response.json(days);
  } catch (e) {
    console.error('[GET /api/activity]', e);
    return Response.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
