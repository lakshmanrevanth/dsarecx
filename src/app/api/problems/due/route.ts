// GET /api/problems/due[?before=ISO] — today's due and overdue problems

import type { NextRequest } from 'next/server';
import { getRequestTimeZone, dayRangeInTz } from '@/lib/dates';
import { currentUserId, jsonError, unauthorized } from '../../_shared/http';
import { getDueProblems } from './query';

export async function GET(request: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return unauthorized();

    const { start, end } = dayRangeInTz(new Date(), getRequestTimeZone(request));

    // An explicit end of day from the client wins over the timezone cookie.
    const before = request.nextUrl.searchParams.get('before');
    const explicitEnd = before ? new Date(before) : null;
    const endOfToday = explicitEnd && !isNaN(explicitEnd.getTime()) ? explicitEnd : end;

    return Response.json(await getDueProblems(userId, start, endOfToday));
  } catch (e) {
    console.error('[GET /api/problems/due]', e);
    return jsonError('Failed to fetch due problems', 500);
  }
}
