// The shared sender and paper-card layout used by every transactional email
// (signup verification, password reset, email change).
//
// Two ways to send, checked in this order:
//   1. SMTP, e.g. a Gmail account with an app password: SMTP_USER + SMTP_PASS
//      (SMTP_HOST / SMTP_PORT default to Gmail). Needs no domain of your own.
//   2. Resend: RESEND_API_KEY, with EMAIL_FROM on a domain verified in Resend.
// With neither, nothing is sent: in development the email is described in the
// server log, in production the send reports an error.

import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';
import { defaultEmailFrom, siteConfig } from '@/config/site';

export type SendResult = { success: boolean; error?: string };

let resendClient: Resend | null | undefined;
let smtpClient: Transporter | null | undefined;

function getResend(): Resend | null {
  if (resendClient === undefined) {
    const key = process.env.RESEND_API_KEY;
    resendClient = key ? new Resend(key) : null;
  }
  return resendClient;
}

function getSmtp(): Transporter | null {
  if (smtpClient === undefined) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS?.replace(/\s+/g, ''); // Gmail shows app passwords with spaces
    if (!user || !pass) {
      smtpClient = null;
    } else {
      const port = Number(process.env.SMTP_PORT || 465);
      smtpClient = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }
  return smtpClient;
}

/** True when some email provider is configured. */
export function hasEmailProvider(): boolean {
  return Boolean((process.env.SMTP_USER && process.env.SMTP_PASS) || process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  // Gmail only sends as the signed-in account, so use it with the app's name.
  if (process.env.SMTP_USER) return `${siteConfig.name} <${process.env.SMTP_USER}>`;
  return defaultEmailFrom;
}

/** Escapes text for safe interpolation into email HTML (names come from user input). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Public base URL of the app, without a trailing slash. */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/** Sends one email. When no provider is configured, `devNote` is logged instead (development only). */
export async function sendEmail(params: { to: string; subject: string; html: string; devNote: string }): Promise<SendResult> {
  const smtp = getSmtp();
  const resend = smtp ? null : getResend();
  if (!smtp && !resend) {
    if (process.env.NODE_ENV === 'production') return { success: false, error: 'Email is not configured' };
    console.log(`\n[${siteConfig.name.toUpperCase()} MAIL] ${params.devNote} (set SMTP_USER/SMTP_PASS or RESEND_API_KEY to send real emails)\n`);
    return { success: true };
  }
  try {
    if (smtp) {
      await smtp.sendMail({ from: fromAddress(), to: params.to, subject: params.subject, html: params.html });
      return { success: true };
    }
    const { error } = await resend!.emails.send({ from: fromAddress(), to: params.to, subject: params.subject, html: params.html });
    return error ? { success: false, error: error.message } : { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to send email' };
  }
}

// Palette from DESIGN.md: paper, card, ink, ember. Emails are always light
// (most clients ignore dark-mode CSS), so these are the light-theme values.
export const EMAIL_COLORS = {
  paper: '#f0ebe1',
  card: '#fbf8f2',
  ink: '#161311',
  muted: '#635c55',
  faint: '#857c72',
  rule: '#ddd3c5',
  ember: '#ff6a1f',
} as const;

const SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const DEFAULT_FOOTER = `${escapeHtml(siteConfig.name)} &middot; ${escapeHtml(siteConfig.tagline)}`;

/** Paragraph row for use inside emailLayout(). `html` must already be escaped. */
export function emailParagraph(html: string): string {
  return `<tr><td style="padding-bottom:24px;font-family:${SANS};font-size:15px;line-height:1.6;color:${EMAIL_COLORS.muted};">${html}</td></tr>`;
}

/** Wraps rows of body HTML in the dsarecx paper card layout. `title` is escaped here. */
export function emailLayout(title: string, bodyHtml: string, footerHtml = ''): string {
  const c = EMAIL_COLORS;
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light"><title>${safeTitle}</title></head>
<body style="margin:0;padding:0;background-color:${c.paper};font-family:${SANS};color:${c.ink};">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:${c.paper};padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:${c.card};border:1px solid ${c.rule};border-radius:16px;padding:36px 28px;text-align:left;">
        <tr><td style="padding-bottom:28px;"><span style="font-family:${SERIF};font-style:italic;font-size:28px;color:${c.ink};"><span style="color:${c.ember};font-style:normal;">&#9679;</span> ${escapeHtml(siteConfig.logoWord)}</span></td></tr>
        <tr><td style="padding-bottom:14px;"><h1 style="margin:0;font-family:${SERIF};font-weight:400;font-size:30px;line-height:1.15;color:${c.ink};">${safeTitle}</h1></td></tr>
        ${bodyHtml}
        <tr><td style="border-top:1px solid ${c.rule};padding-top:20px;font-family:${MONO};font-size:11px;letter-spacing:0.04em;color:${c.faint};line-height:1.6;">${footerHtml || DEFAULT_FOOTER}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** A pill button row (ink fill, paper text) for use inside emailLayout(). */
export function emailButton(href: string, label: string): string {
  const c = EMAIL_COLORS;
  return `<tr><td style="padding-bottom:28px;"><a href="${escapeHtml(href)}" style="display:inline-block;background:${c.ink};color:${c.card};text-decoration:none;font-family:${SANS};font-size:14px;font-weight:600;padding:12px 22px;border-radius:999px;">${escapeHtml(label)} <span style="color:${c.ember};">&rarr;</span></a></td></tr>`;
}

/** A large one-time-code box for use inside emailLayout(). */
export function emailCodeBox(code: string): string {
  const c = EMAIL_COLORS;
  return `<tr><td style="padding-bottom:24px;" align="center"><div style="background-color:${c.paper};border:1px solid ${c.rule};border-radius:12px;padding:18px 24px;text-align:center;"><span style="font-family:${MONO};font-size:32px;font-weight:700;letter-spacing:8px;color:${c.ink};">${escapeHtml(code)}</span></div></td></tr>`;
}

/** "Hi Name," (escaped, max 60 chars) or "Hello,". */
export function emailGreeting(name?: string | null): string {
  const clean = name ? escapeHtml(name.trim().slice(0, 60)) : '';
  return clean ? `Hi ${clean},` : 'Hello,';
}
