// GET /api/streak — current and best streak plus today's progress for the signed-in user

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getRequestTimeZone } from '@/lib/dates';
import { getUserPreferences } from '@/lib/preferences';
import { getStreakSummary } from './compute';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const prefs = await getUserPreferences(userId);
    return Response.json(await getStreakSummary(userId, getRequestTimeZone(request), prefs));
  } catch (e) {
    console.error('[GET /api/streak]', e);
    return Response.json({ error: 'Failed to fetch streak' }, { status: 500 });
  }
}
