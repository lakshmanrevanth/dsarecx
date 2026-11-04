// POST /api/account/email/verify — check the code sent to the new address and switch to it.
// Body: { newEmail, code }

import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { clearOtpFailures, isOtpLocked, recordOtpFailure } from '@/lib/otp-guard';
import { emailChangeIdentifier, json, normalizeEmail, readJson } from '../../shared';

const LOCKED_MESSAGE = 'Too many wrong codes. Please wait 10 minutes, then request a new code.';
const TAKEN_MESSAGE = 'That email is already used by another account';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const body = await readJson(req);
    const newEmail = normalizeEmail(body.newEmail);
    const code = String(body.code ?? '').trim();
    if (!newEmail) return json({ error: 'Enter a valid email address' }, 400);
    if (!/^\d{6}$/.test(code)) return json({ error: 'The code must be 6 digits' }, 400);

    const identifier = emailChangeIdentifier(userId, newEmail);
    if (await isOtpLocked(identifier)) return json({ error: LOCKED_MESSAGE }, 429);

    const match = await prisma.verificationToken.findFirst({
      where: { identifier, token: `ec_${userId}_${code}`, expires: { gt: new Date() } },
    });
    if (!match) {
      const remaining = await recordOtpFailure(identifier);
      return remaining === 0
        ? json({ error: LOCKED_MESSAGE }, 429)
        : json({ error: 'Invalid or expired code' }, 400);
    }

    const owner = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
    if (owner && owner.id !== userId) return json({ error: TAKEN_MESSAGE }, 409);

    try {
      await prisma.user.update({ where: { id: userId }, data: { email: newEmail, emailVerified: new Date() } });
    } catch (e) {
      // Unique violation: the address was taken between the check above and this update.
      if ((e as { code?: string }).code === 'P2002') return json({ error: TAKEN_MESSAGE }, 409);
      throw e;
    }

    await prisma.verificationToken.deleteMany({ where: { identifier } });
    await clearOtpFailures(identifier);

    return json({ success: true, email: newEmail });
  } catch (e) {
    console.error('[POST /api/account/email/verify]', e);
    return json({ error: 'Failed to change email' }, 500);
  }
}
