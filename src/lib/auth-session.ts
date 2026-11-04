// Ending sessions after a password change.
//
// Every JWT records when it was issued (token.issuedAt). Changing a password
// stores User.passwordChangedAt, and the jwt callback in src/auth.ts rejects
// any token issued before that. The database check result is cached on the
// token for PASSWORD_CHECK_INTERVAL_MS so it doesn't run on every request,
// which is why other sessions end "within 5 minutes" rather than instantly.

import type { JWT } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

export const PASSWORD_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Call after a user's password changes. This ends every session, including the
 * current one, so the caller should sign the user in again with the new password.
 */
export async function bumpPasswordChangedAt(userId: string): Promise<Date> {
  const now = new Date();
  await prisma.user.update({ where: { id: userId }, data: { passwordChangedAt: now } });
  return now;
}

/**
 * Returns the token (with a refreshed check time when the DB was consulted),
 * or null when the session must end: the password changed after the token was
 * issued, or the user no longer exists.
 */
export async function checkTokenFreshness(token: JWT, now = Date.now()): Promise<JWT | null> {
  const userId = token.id as string | undefined;
  if (!userId) return token;

  // Tokens minted before this check existed: start tracking from now.
  if (typeof token.issuedAt !== 'number') {
    return { ...token, issuedAt: now, pwCheckedAt: now };
  }

  const checkedRecently =
    typeof token.pwCheckedAt === 'number' && now - token.pwCheckedAt < PASSWORD_CHECK_INTERVAL_MS;
  if (checkedRecently) return token;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordChangedAt: true } });
    if (!user) return null;
    if (user.passwordChangedAt && user.passwordChangedAt.getTime() > token.issuedAt) return null;
    return { ...token, pwCheckedAt: now };
  } catch (e) {
    // A database hiccup must not sign everyone out; the check runs again next request.
    console.error('[auth] password-change check failed:', e);
    return token;
  }
}
