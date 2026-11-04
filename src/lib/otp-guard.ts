// Wrong-guess lockout for 6-digit email codes (email verification, password
// reset, email change).
//
// A 6-digit code valid for 10 minutes could otherwise be brute-forced. Each
// wrong guess is stored as an extra VerificationToken row under the identifier
// "fail:<identifier>" (no extra table needed). After MAX_OTP_ATTEMPTS wrong
// guesses the real code is deleted and the user has to request a new one.

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const MAX_OTP_ATTEMPTS = 5;

const FAILURE_TTL_MS = 10 * 60 * 1000;
const failKey = (identifier: string) => `fail:${identifier}`;

/**
 * The value stored in VerificationToken.token for a code. That column is unique
 * across all users, so the raw code would collide when two people get the same
 * code; hashing identifier + code avoids that and never stores raw codes.
 */
export function otpToken(identifier: string, code: string): string {
  return 'otp_' + crypto.createHash('sha256').update(`${identifier}:${code}`).digest('hex');
}

function countFailures(identifier: string): Promise<number> {
  return prisma.verificationToken.count({
    where: { identifier: failKey(identifier), expires: { gt: new Date() } },
  });
}

/** True once this identifier has used up its guesses for the current code. */
export async function isOtpLocked(identifier: string): Promise<boolean> {
  return (await countFailures(identifier)) >= MAX_OTP_ATTEMPTS;
}

/**
 * Records one wrong guess and returns how many guesses remain. When none
 * remain, the real code is deleted so it can't be guessed any more.
 */
export async function recordOtpFailure(identifier: string): Promise<number> {
  await prisma.verificationToken.create({
    data: {
      identifier: failKey(identifier),
      token: `fail_${crypto.randomUUID()}`,
      expires: new Date(Date.now() + FAILURE_TTL_MS),
    },
  });
  const remaining = Math.max(0, MAX_OTP_ATTEMPTS - (await countFailures(identifier)));
  if (remaining === 0) {
    await prisma.verificationToken.deleteMany({ where: { identifier } });
  }
  return remaining;
}

/** Clears the failure counter (after a correct code, or when a new code is issued). */
export async function clearOtpFailures(identifier: string): Promise<void> {
  await prisma.verificationToken.deleteMany({ where: { identifier: failKey(identifier) } });
}
