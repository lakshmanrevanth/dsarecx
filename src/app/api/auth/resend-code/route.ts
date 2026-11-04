// POST /api/auth/resend-code — send a fresh verification code (60s cooldown). Body: { email }
//
// Unknown email, already verified, in cooldown or sent: the response is always the same.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/mail';
import { authRules, checkRateLimits, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { inCooldown, issueCode, normalizeEmail } from '../codes';

const GENERIC_RESPONSE = {
  success: true,
  message: 'If this email is waiting to be verified, a new code is on its way.',
};

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const limited = await checkRateLimits(authRules('resend-code', getClientIp(req.headers), normalizedEmail));
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (user && !user.emailVerified && !(await inCooldown(normalizedEmail))) {
      const code = await issueCode(normalizedEmail);
      const sent = await sendVerificationEmail({ email: normalizedEmail, code, name: user.name });
      if (!sent.success) console.warn('[resend-code] Email send failed:', sent.error);
    }

    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  } catch (e) {
    console.error('[POST /api/auth/resend-code]', e);
    return NextResponse.json({ error: 'Failed to resend verification code. Please try again.' }, { status: 500 });
  }
}
