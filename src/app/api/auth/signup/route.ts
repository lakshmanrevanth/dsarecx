// POST /api/auth/signup — create an email + password account and email a verification code.
// Body: { name?, email, password }
//
// Answers identically whether or not the email is registered, so it can't be used
// to discover accounts.

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/mail';
import { authRules, checkRateLimits, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { issueCode, normalizeEmail } from '../codes';

const MIN_PASSWORD_LENGTH = 8;

function checkEmailResponse(email: string) {
  return NextResponse.json(
    { requiresVerification: true, message: 'Check your email for a 6-digit verification code.', email },
    { status: 201 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const limited = await checkRateLimits(authRules('signup', getClientIp(req.headers), normalizedEmail));
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    // Hash before looking the user up so both branches take about as long.
    const hashed = await bcrypt.hash(password, 12);

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { accounts: { select: { id: true }, take: 1 } },
    });

    // A verified account — including any OAuth-linked one, even with emailVerified unset — is
    // never touched: overwriting its password would let a stranger take it over.
    if (existing && (existing.emailVerified || (existing.accounts?.length ?? 0) > 0)) {
      return checkEmailResponse(normalizedEmail);
    }

    if (existing) {
      // Never verified: the new signup replaces the old password and name.
      await prisma.user.update({
        where: { id: existing.id },
        data: { name: name || existing.name, password: hashed, passwordChangedAt: new Date() },
      });
    } else {
      await prisma.user.create({
        data: { name, email: normalizedEmail, password: hashed, emailVerified: null },
      });
    }

    const code = await issueCode(normalizedEmail);
    const sent = await sendVerificationEmail({ email: normalizedEmail, code, name });
    if (!sent.success) console.warn('[signup] Email send failed, but token was created:', sent.error);

    return checkEmailResponse(normalizedEmail);
  } catch (e) {
    console.error('[POST /api/auth/signup]', e);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
