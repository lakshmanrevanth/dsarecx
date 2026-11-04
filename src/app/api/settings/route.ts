// GET   /api/settings — the user's profile and preferences
// PATCH /api/settings — update the display name and/or any preference field

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getUserPreferences, parsePreferencesUpdate, PREFERENCE_SELECT, toPreferences } from '@/lib/preferences';

const NAME_MAX_LENGTH = 60;

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return fail('Unauthorized', 401);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    });
    if (!user) return fail('User not found', 404);

    return Response.json({ user, preferences: await getUserPreferences(userId) });
  } catch (e) {
    console.error('[GET /api/settings]', e);
    return fail('Failed to fetch settings', 500);
  }
}

/** Validates an optional `name` field: undefined when absent, a string when valid, or an error. */
function parseName(input: Record<string, unknown>): { name?: string } | { error: string } {
  if (!('name' in input)) return {};
  if (typeof input.name !== 'string') return { error: 'Name must be text' };
  const name = input.name.trim();
  if (!name) return { error: 'Name cannot be empty' };
  if (name.length > NAME_MAX_LENGTH) return { error: `Name must be at most ${NAME_MAX_LENGTH} characters` };
  return { name };
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return fail('Unauthorized', 401);

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Invalid request body', 400);
    const input = body as Record<string, unknown>;

    const name = parseName(input);
    if ('error' in name) return fail(name.error, 400);
    const prefs = parsePreferencesUpdate(input);
    if ('error' in prefs) return fail(prefs.error, 400);

    const data: Record<string, unknown> = { ...(name.name !== undefined ? { name: name.name } : {}), ...prefs.data };
    if (Object.keys(data).length === 0) return fail('Nothing to update', 400);

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, ...PREFERENCE_SELECT },
    });

    const { id, name: savedName, email, ...preferenceRow } = updated;
    return Response.json({
      success: true,
      user: { id, name: savedName, email },
      preferences: toPreferences(preferenceRow),
    });
  } catch (e) {
    console.error('[PATCH /api/settings]', e);
    return fail('Failed to update settings', 500);
  }
}
