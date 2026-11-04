// Small response helpers shared by the problem, column, list and concept routes.
// The `_shared` folder is private (not routed) by Next.js convention.

import { auth } from '@/auth';

/** Disables HTTP caching; SWR owns client-side caching. */
export const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' } as const;

/** `{ error, ...extra }` with the given status. */
export function jsonError(
  error: string,
  status: number,
  extra?: Record<string, unknown>,
  headers?: HeadersInit
): Response {
  return Response.json({ error, ...extra }, { status, headers });
}

export const badRequest = (error: string) => jsonError(error, 400);
export const unauthorized = () => jsonError('Unauthorized', 401);

/** The signed-in user's id, or null when there is no session. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export { isUniqueViolation } from '../lists/helpers';

/** Route context for `[id]` segments. */
export type IdContext = { params: Promise<{ id: string }> };
