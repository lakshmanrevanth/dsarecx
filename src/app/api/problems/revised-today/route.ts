// GET /api/problems/revised-today — problems the user rated today (their local day)

import type { NextRequest } from 'next/server';
import { getRequestTimeZone, dayRangeInTz } from '@/lib/dates';
import { currentUserId, jsonError, unauthorized } from '../../_shared/http';
import { getRevisedToday } from './query';

export async function GET(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    // The server runs in UTC; the day boundary comes from the timezone cookie.
    const { start, end } = dayRangeInTz(new Date(), getRequestTimeZone(request));
    return Response.json(await getRevisedToday(userId, start, end));
  } catch (e) {
    console.error('[GET /api/problems/revised-today]', e);
    return jsonError('Failed to fetch revised problems', 500);
  }
}
