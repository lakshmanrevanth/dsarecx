// POST /api/auth/verify-code — check a signup code and mark the email verified. Body: { email, code }

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clearOtpFailures, isOtpLocked, otpToken, recordOtpFailure } from '@/lib/otp-guard';
import { AUTH_LIMITS, checkRateLimits, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { LOCKED_MESSAGE, normalizeEmail } from '../codes';

const locked = () => NextResponse.json({ error: LOCKED_MESSAGE }, { status: 429 });

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (!email || !code || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email and verification code are required' }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const cleanCode = String(code).trim();
    if (cleanCode.length !== 6) {
      return NextResponse.json({ error: 'Verification code must be 6 digits' }, { status: 400 });
    }

    const limited = await checkRateLimits([
      { key: `verify-code:ip:${getClientIp(req.headers)}`, ...AUTH_LIMITS.codeCheckPerIp },
    ]);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    if (await isOtpLocked(normalizedEmail)) return locked();

    const match = await prisma.verificationToken.findFirst({
      where: { identifier: normalizedEmail, token: otpToken(normalizedEmail, cleanCode), expires: { gt: new Date() } },
    });
    if (!match) {
      if ((await recordOtpFailure(normalizedEmail)) === 0) return locked();
      return NextResponse.json(
        { error: 'Invalid or expired verification code. Please request a new one.' },
        { status: 400 }
      );
    }

    await prisma.user.update({ where: { email: normalizedEmail }, data: { emailVerified: new Date() } });
    await prisma.verificationToken.deleteMany({ where: { identifier: normalizedEmail } });
    await clearOtpFailures(normalizedEmail);

    return NextResponse.json({ success: true, message: 'Email verified successfully' }, { status: 200 });
  } catch (e) {
    console.error('[POST /api/auth/verify-code]', e);
    return NextResponse.json({ error: 'Something went wrong while verifying the code' }, { status: 500 });
  }
}
