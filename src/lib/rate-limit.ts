// Fixed-window rate limiter backed by the RateLimit table.
//
// Each key (e.g. "signup:ip:1.2.3.4") has a counter and the time its window
// ends. The first hit after a window ends resets the row; later hits increment
// it. If the database fails we let the request through (fail open) and log it,
// so a limiter problem can never lock everyone out of signing in.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
};

export const MINUTE = 60 * 1000;

const CLEANUP_PROBABILITY = 0.01;
const CLEANUP_AGE_MS = 24 * 60 * MINUTE;

/** Counts one hit against `key`. Returns ok:false once more than `limit` hits land in the window. */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowMs);

    // Expired window: restart it with this hit as the first one.
    const restarted = await prisma.rateLimit.updateMany({
      where: { key, resetAt: { lte: now } },
      data: { count: 1, resetAt: windowEnd },
    });
    if (restarted.count > 0) {
      maybeCleanup(now);
      return { ok: true };
    }

    const row = await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, resetAt: windowEnd },
      update: { count: { increment: 1 } },
    });
    if (row.count <= limit) return { ok: true };

    const retryAfterSec = Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000));
    return { ok: false, retryAfterSec };
  } catch (e) {
    console.error('[rate-limit] limiter failed, allowing request:', e);
    return { ok: true };
  }
}

/** Applies every rule (each counts a hit) and returns the blocked result with the longest wait, if any. */
export async function checkRateLimits(rules: RateLimitRule[]): Promise<RateLimitResult> {
  let worst: RateLimitResult = { ok: true };
  for (const rule of rules) {
    const result = await rateLimit(rule.key, rule.limit, rule.windowMs);
    if (!result.ok && (worst.ok || result.retryAfterSec > worst.retryAfterSec)) worst = result;
  }
  return worst;
}

/**
 * Best-effort client IP from proxy headers. Trusts x-forwarded-for, which is
 * correct on Vercel (it overwrites the header); other hosts must do the same.
 */
export function getClientIp(headers: Headers): string {
  const first = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (first) return first;
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

export function rateLimitMessage(retryAfterSec: number): string {
  if (retryAfterSec < 60) return `Too many attempts. Please try again in ${retryAfterSec} seconds.`;
  const minutes = Math.ceil(retryAfterSec / 60);
  return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

/** Standard 429 response with a friendly message and a Retry-After header. */
export function rateLimitResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: rateLimitMessage(retryAfterSec), code: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
  );
}

/** Now and then, delete long-expired rows so the table stays small. */
function maybeCleanup(now: Date) {
  if (Math.random() > CLEANUP_PROBABILITY) return;
  prisma.rateLimit
    .deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - CLEANUP_AGE_MS) } } })
    .catch((e: unknown) => console.error('[rate-limit] cleanup failed:', e));
}

/** Shared limits for the auth routes. */
export const AUTH_LIMITS = {
  perIp: { limit: 10, windowMs: 15 * MINUTE },
  perEmail: { limit: 5, windowMs: 15 * MINUTE },
  // Code checks have their own wrong-guess lockout, so they allow more per IP.
  codeCheckPerIp: { limit: 20, windowMs: 15 * MINUTE },
  signInPerIp: { limit: 20, windowMs: 15 * MINUTE },
  signInPerEmailIp: { limit: 5, windowMs: 15 * MINUTE },
} as const;

/** Per-IP (and, when given, per-email) rules for one auth route. */
export function authRules(route: string, ip: string, email?: string): RateLimitRule[] {
  const rules: RateLimitRule[] = [{ key: `${route}:ip:${ip}`, ...AUTH_LIMITS.perIp }];
  if (email) rules.push({ key: `${route}:email:${email}`, ...AUTH_LIMITS.perEmail });
  return rules;
}
