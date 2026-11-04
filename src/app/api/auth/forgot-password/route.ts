// POST /api/auth/forgot-password — email a 6-digit reset code (60s cooldown). Body: { email }
//
// Unknown email, OAuth-only account, cooldown or sent: the response is always the same,
// so the endpoint can't be used to discover accounts.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/mail';
import { authRules, checkRateLimits, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { inCooldown, issueCode, normalizeEmail } from '../codes';

const GENERIC_RESPONSE = {
  success: true,
  message:
    'If an account with a password exists for this email, a reset code has been sent. If you signed up with Google or GitHub, sign in with that instead.',
};

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const limited = await checkRateLimits(authRules('forgot-password', getClientIp(req.headers), normalizedEmail));
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    const identifier = `reset:${normalizedEmail}`;

    // Only accounts with a password can reset one.
    if (user?.password && !(await inCooldown(identifier))) {
      const code = await issueCode(identifier);
      const sent = await sendPasswordResetEmail({ email: normalizedEmail, code, name: user.name });
      if (!sent.success) console.warn('[forgot-password] Email send failed:', sent.error);
    }

    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  } catch (e) {
    console.error('[POST /api/auth/forgot-password]', e);
    return NextResponse.json({ error: 'Failed to process password reset request. Please try again.' }, { status: 500 });
  }
}
