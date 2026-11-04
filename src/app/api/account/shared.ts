// Helpers shared by the /api/account/* route handlers.

import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { siteConfig } from '@/config/site';
import { emailLayout, escapeHtml, sendEmail } from '@/lib/email-layout';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;
/** Email-change codes live for 10 minutes. */
export const CODE_TTL_MS = 10 * 60 * 1000;
/** Setting a first password on an OAuth-only account requires a sign-in this recent. */
export const RECENT_SIGN_IN_MS = 10 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

/** Parses a JSON object body; anything else (invalid JSON, arrays, primitives) becomes {}. */
export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  return {};
}

/** Lower-cased, trimmed email, or null when the value isn't a plausible address. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

/** A user-facing error for an unacceptable password, or null when it's fine. */
export function passwordError(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (value.length > MAX_PASSWORD_LENGTH) return 'Password is too long';
  return null;
}

export const emailChangePrefix = (userId: string) => `email-change:${userId}:`;
export const emailChangeIdentifier = (userId: string, newEmail: string) => `${emailChangePrefix(userId)}${newEmail}`;

/**
 * When the user last actually signed in (ms since epoch), read from the session JWT.
 * `signedInAt` is written by src/auth.ts only on a real sign-in; `iat`/`issuedAt` are not
 * used because Auth.js refreshes them whenever it re-issues the token.
 */
export async function getSignedInAt(req: NextRequest): Promise<number | null> {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const token = await getToken({ req, secret, secureCookie: req.nextUrl.protocol === 'https:' });
  const signedInAt = token?.signedInAt;
  return typeof signedInAt === 'number' ? signedInAt : null;
}

export async function sendEmailChangeCode({ to, code }: { to: string; code: string }) {
  const body = `
        <tr><td style="padding-bottom:24px;font-size:15px;line-height:1.6;color:#3d3833;">Enter this code in ${siteConfig.name} settings to confirm <strong style="color:#161311;">${escapeHtml(to)}</strong> as your new sign-in email.</td></tr>
        <tr><td style="padding-bottom:24px;" align="center"><div style="background-color:#f0ebe1;border:1px solid #e2dacb;border-radius:12px;padding:18px 24px;text-align:center;"><span style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#161311;">${code}</span></div></td></tr>
        <tr><td style="padding-bottom:28px;font-size:13px;color:#6b635a;line-height:1.5;">This code expires in 10 minutes. If you did not ask to change your email, ignore this message.</td></tr>`;
  return sendEmail({
    to,
    subject: `${code} is your ${siteConfig.name} email change code`,
    html: emailLayout('Confirm your new email', body),
    devNote: `Email change code for ${to}: ${code}`,
  });
}
