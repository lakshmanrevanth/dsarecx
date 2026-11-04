// POST /api/account/email — email a 6-digit code to a new address. Body: { newEmail }
// The change is confirmed with POST /api/account/email/verify.

import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  CODE_TTL_MS,
  emailChangeIdentifier,
  emailChangePrefix,
  json,
  normalizeEmail,
  readJson,
  sendEmailChangeCode,
} from '../shared';

const RESEND_COOLDOWN_MS = 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const newEmail = normalizeEmail((await readJson(req)).newEmail);
    if (!newEmail) return json({ error: 'Enter a valid email address' }, 400);

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return json({ error: 'User not found' }, 404);
    if (user.email.toLowerCase() === newEmail) return json({ error: 'That is already your email' }, 400);

    const owner = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
    if (owner) return json({ error: 'That email is already used by another account' }, 409);

    // A user has at most one pending change; codes can't be requested back to back.
    const prefix = emailChangePrefix(userId);
    const pending = await prisma.verificationToken.findFirst({
      where: { identifier: { startsWith: prefix }, expires: { gt: new Date() } },
      orderBy: { expires: 'desc' },
    });
    if (pending) {
      const sinceIssued = CODE_TTL_MS - (pending.expires.getTime() - Date.now());
      if (sinceIssued >= 0 && sinceIssued < RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((RESEND_COOLDOWN_MS - sinceIssued) / 1000);
        return json({ error: `Please wait ${wait}s before requesting a new code.` }, 429);
      }
    }

    await prisma.verificationToken.deleteMany({ where: { identifier: { startsWith: prefix } } });

    // Wrong-guess records ("fail:<identifier>") are deliberately kept: clearing them with each
    // new code would allow 5 guesses per cooldown forever. They expire on their own.
    const code = crypto.randomInt(100000, 1000000).toString();
    await prisma.verificationToken.create({
      data: {
        identifier: emailChangeIdentifier(userId, newEmail),
        // The token column is globally unique, so scope it to the user.
        token: `ec_${userId}_${code}`,
        expires: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    const sent = await sendEmailChangeCode({ to: newEmail, code });
    if (!sent.success) return json({ error: 'Could not send the code. Please try again later.' }, 502);

    return json({ success: true });
  } catch (e) {
    console.error('[POST /api/account/email]', e);
    return json({ error: 'Failed to start email change' }, 500);
  }
}
