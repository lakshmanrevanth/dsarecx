import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMail = vi.fn();
const createTransport = vi.fn(() => ({ sendMail }));
const resendSend = vi.fn();
vi.mock('nodemailer', () => ({ default: { createTransport } }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

const ENV_KEYS = ['SMTP_USER', 'SMTP_PASS', 'SMTP_HOST', 'SMTP_PORT', 'RESEND_API_KEY', 'EMAIL_FROM'];
const mail = { to: 'student@example.com', subject: 'Code', html: '<p>1</p>', devNote: 'note' };

async function load() {
  vi.resetModules();
  return import('./email-layout');
}

describe('sendEmail provider choice', () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
    vi.clearAllMocks();
  });
  afterEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
  });

  it('sends through Gmail SMTP when SMTP_USER and SMTP_PASS are set, as the Gmail account', async () => {
    process.env.SMTP_USER = 'me@gmail.com';
    process.env.SMTP_PASS = 'abcd efgh ijkl mnop';
    process.env.RESEND_API_KEY = 're_ignored';
    sendMail.mockResolvedValue({ messageId: '1' });
    const { sendEmail, hasEmailProvider } = await load();
    expect(hasEmailProvider()).toBe(true);
    expect(await sendEmail(mail)).toEqual({ success: true });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: 'me@gmail.com', pass: 'abcdefghijklmnop' } }),
    );
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'dsarecx <me@gmail.com>', to: 'student@example.com' }));
    expect(resendSend).not.toHaveBeenCalled();
  });

  it('reports an SMTP failure instead of throwing', async () => {
    process.env.SMTP_USER = 'me@gmail.com';
    process.env.SMTP_PASS = 'wrong';
    sendMail.mockRejectedValue(new Error('Invalid login: 535 Username and Password not accepted'));
    const { sendEmail } = await load();
    expect(await sendEmail(mail)).toEqual({ success: false, error: 'Invalid login: 535 Username and Password not accepted' });
  });

  it('falls back to Resend when SMTP is not configured', async () => {
    process.env.RESEND_API_KEY = 're_key';
    process.env.EMAIL_FROM = 'dsarecx <noreply@example.com>';
    resendSend.mockResolvedValue({ error: null });
    const { sendEmail } = await load();
    expect(await sendEmail(mail)).toEqual({ success: true });
    expect(resendSend).toHaveBeenCalledWith(expect.objectContaining({ from: 'dsarecx <noreply@example.com>' }));
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('has no provider when nothing is set', async () => {
    const { hasEmailProvider } = await load();
    expect(hasEmailProvider()).toBe(false);
  });
});
