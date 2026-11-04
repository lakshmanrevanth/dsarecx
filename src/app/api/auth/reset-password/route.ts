// POST /api/auth/reset-password — check a reset code and set a new password.
// Body: { email, code, newPassword }
// Proving ownership of the inbox also verifies the email. passwordChangedAt signs out
// every existing session (see src/auth.ts).

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { clearOtpFailures, isOtpLocked, otpToken, recordOtpFailure } from '@/lib/otp-guard';
import { AUTH_LIMITS, checkRateLimits, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { LOCKED_MESSAGE, normalizeEmail } from '../codes';

const MIN_PASSWORD_LENGTH = 8;
const locked = () => NextResponse.json({ error: LOCKED_MESSAGE }, { status: 429 });

export async function POST(req: NextRequest) {
  try {
    const { email, code, newPassword } = await req.json();
    if (!email || !code || !newPassword || typeof email !== 'string' || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'Email, reset code, and new password are required.' }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const cleanCode = String(code).trim();
    if (cleanCode.length !== 6) {
      return NextResponse.json({ error: 'Reset code must be 6 digits.' }, { status: 400 });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` },
        { status: 400 }
      );
    }

    const limited = await checkRateLimits([
      { key: `reset-password:ip:${getClientIp(req.headers)}`, ...AUTH_LIMITS.codeCheckPerIp },
    ]);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const identifier = `reset:${normalizedEmail}`;
    if (await isOtpLocked(identifier)) return locked();

    const match = await prisma.verificationToken.findFirst({
      where: { identifier, token: otpToken(identifier, cleanCode), expires: { gt: new Date() } },
    });
    if (!match) {
      if ((await recordOtpFailure(identifier)) === 0) return locked();
      return NextResponse.json(
        { error: 'Invalid or expired reset code. Please request a new code.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return NextResponse.json({ error: 'No account found with this email address.' }, { status: 404 });
    }

    const now = new Date();
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        password: await bcrypt.hash(newPassword, 12),
        emailVerified: user.emailVerified ?? now,
        passwordChangedAt: now,
      },
    });

    await prisma.verificationToken.deleteMany({ where: { identifier } });
    await clearOtpFailures(identifier);

    return NextResponse.json(
      { success: true, message: 'Password reset successfully! Please sign in with your new password.' },
      { status: 200 }
    );
  } catch (e) {
    console.error('[POST /api/auth/reset-password]', e);
    return NextResponse.json({ error: 'Something went wrong while resetting your password.' }, { status: 500 });
  }
}
