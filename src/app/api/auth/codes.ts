// Shared helpers for the 6-digit email codes used by signup, resend-code and forgot-password.

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { otpToken } from '@/lib/otp-guard';

export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const LOCKED_MESSAGE = 'Too many wrong codes. Please wait 10 minutes, then request a new code.';

export const normalizeEmail = (email: string) => email.toLowerCase().trim();

/** True when a code for `identifier` was issued less than RESEND_COOLDOWN_MS ago. */
export async function inCooldown(identifier: string): Promise<boolean> {
  const existing = await prisma.verificationToken.findFirst({ where: { identifier } });
  if (!existing) return false;
  const sinceIssued = CODE_TTL_MS - (existing.expires.getTime() - Date.now());
  return sinceIssued >= 0 && sinceIssued < RESEND_COOLDOWN_MS;
}

/**
 * Replace any pending code for `identifier` with a fresh one and return it.
 * Wrong-guess records ("fail:<identifier>") are left alone so a new code never resets the lockout.
 */
export async function issueCode(identifier: string): Promise<string> {
  const code = crypto.randomInt(100000, 1000000).toString();
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token: otpToken(identifier, code), expires: new Date(Date.now() + CODE_TTL_MS) },
  });
  return code;
}
