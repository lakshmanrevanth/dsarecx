// Account emails that carry a 6-digit code: signup verification and password
// reset. Without an email provider (see email-layout.ts) the code is printed to the server log in
// development; in production that is never done (logs are shared and stored)
// and the send reports an error instead.

import { siteConfig } from '@/config/site';
import {
  EMAIL_COLORS,
  emailCodeBox,
  emailGreeting,
  emailLayout,
  emailParagraph,
  hasEmailProvider,
  sendEmail,
} from '@/lib/email-layout';

type SendResult = { success: boolean; error?: string };

type CodeEmail = {
  label: string;
  logTag: string;
  email: string;
  code: string;
  subject: string;
  title: string;
  intro: string;
  outro: string;
};

function hasProvider(): boolean {
  return hasEmailProvider();
}

async function sendCodeEmail(mail: CodeEmail): Promise<SendResult> {
  if (!hasProvider()) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`[mail] No email provider (SMTP_USER/SMTP_PASS or RESEND_API_KEY); could not send ${mail.label} email.`);
      return { success: false, error: 'Email is not configured' };
    }
    console.log(
      `\n[${siteConfig.name.toUpperCase()} ${mail.label}] Code for ${mail.email}: ${mail.code} (expires in 10 minutes). Set SMTP_USER/SMTP_PASS or RESEND_API_KEY to send real emails.\n`
    );
    return { success: true };
  }

  const body =
    emailParagraph(mail.intro) +
    emailCodeBox(mail.code) +
    `<tr><td style="padding-bottom:28px;font-size:13px;color:${EMAIL_COLORS.muted};line-height:1.6;">${mail.outro}</td></tr>`;

  const result = await sendEmail({
    to: mail.email,
    subject: mail.subject,
    html: emailLayout(mail.title, body),
    devNote: `${mail.label} code for ${mail.email}`,
  });
  if (!result.success) console.error(`[${mail.logTag}] send failed:`, result.error);
  return result;
}

interface SendVerificationEmailParams {
  email: string;
  code: string;
  name?: string | null;
}

export async function sendVerificationEmail({ email, code, name }: SendVerificationEmailParams): Promise<{ success: boolean; error?: string }> {
  return sendCodeEmail({
    label: 'VERIFICATION',
    logTag: 'sendVerificationEmail',
    email,
    code,
    subject: `${code} is your ${siteConfig.name} verification code`,
    title: 'Verify your email address',
    intro: `${emailGreeting(name)} enter this 6-digit code to finish creating your ${siteConfig.name} account.`,
    outro: 'This code expires in <strong>10 minutes</strong>. If you did not request it, you can safely ignore this email.',
  });
}

interface SendPasswordResetEmailParams {
  email: string;
  code: string;
  name?: string | null;
}

export async function sendPasswordResetEmail({ email, code, name }: SendPasswordResetEmailParams): Promise<{ success: boolean; error?: string }> {
  return sendCodeEmail({
    label: 'PASSWORD RESET',
    logTag: 'sendPasswordResetEmail',
    email,
    code,
    subject: `${code} is your ${siteConfig.name} password reset code`,
    title: 'Reset your password',
    intro: `${emailGreeting(name)} we received a request to reset your ${siteConfig.name} password. Enter this 6-digit code to choose a new one.`,
    outro:
      'This code expires in <strong>10 minutes</strong>. If you did not ask for a password reset, your account is safe and you can ignore this email.',
  });
}
