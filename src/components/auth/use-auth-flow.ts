'use client';

// All state and handlers for sign in / sign up / verify email / forgot / reset.
// The login page renders every screen from this one hook, at every width.

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { safeCallbackUrl } from '@/lib/safe-redirect';

export type AuthTab = 'signin' | 'signup';
export type AuthMode = 'form' | 'verify' | 'forgot' | 'reset';
export type OAuthProvider = 'github';

export const RESEND_COOLDOWN_SEC = 60;
export const MIN_PASSWORD = 8;
export const CODE_LENGTH = 6;

export const errorMessages: Record<string, string> = {
  OAuthAccountNotLinked:
    'This email is already registered with a different sign-in method. Sign in the way you did originally.',
  OAuthCallback: 'Something went wrong while signing in with that provider. Please try again.',
  OAuthCallbackError: 'Something went wrong while signing in with that provider. Please try again.',
  OAuthSignin: 'Could not start sign-in with that provider. Please try again.',
  AccessDenied: 'Sign-in was cancelled or access was denied.',
  Configuration: 'Sign-in is temporarily unavailable. Please try again later.',
  Verification: 'That sign-in link is no longer valid. Please sign in again.',
  CredentialsSignin: 'Invalid email or password.',
  EmailNotVerified: 'Your email is not verified yet. Enter the code we sent to your email.',
  SessionRequired: 'Please sign in to continue.',
  RateLimited: 'Too many attempts. Please wait a few minutes and try again.',
  Default: 'Something unexpected went wrong. Please try again.',
};

/** Message for a ?error= query param from a NextAuth redirect (null when there is none). */
export function errorFromParam(param: string | null | undefined): string | null {
  if (!param) return null;
  return Object.prototype.hasOwnProperty.call(errorMessages, param) ? errorMessages[param] : errorMessages.Default;
}

/** Map a NextAuth signIn() result to a message (null on success, and for email_not_verified, which has its own screen). */
export function signInErrorMessage(res: { error?: string | null; code?: string | null } | undefined): string | null {
  if (!res?.error) return null;
  if (res.code === 'email_not_verified') return null;
  if (res.code === 'rate_limited') return errorMessages.RateLimited;
  return errorMessages.CredentialsSignin;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignIn(email: string, password: string): string | null {
  if (!email.trim() || !password) return 'Please enter your email and password.';
  return null;
}

export function validateSignUp(email: string, password: string): string | null {
  if (!email.trim()) return 'Please enter your email address.';
  if (!EMAIL_RE.test(email.trim())) return 'Please enter a valid email address.';
  if (password.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
  return null;
}

export function validateCode(code: string): string | null {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code) ? null : `Please enter the full ${CODE_LENGTH}-digit code.`;
}

export function validateReset(code: string, password: string, confirm: string): string | null {
  return (
    validateCode(code) ??
    (password.length < MIN_PASSWORD
      ? `Password must be at least ${MIN_PASSWORD} characters.`
      : password !== confirm
        ? 'Passwords do not match.'
        : null)
  );
}

type ApiJson = { error?: string; message?: string; requiresVerification?: boolean };

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; json: ApiJson }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as ApiJson;
  return { ok: res.ok, json };
}

function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return [seconds, setSeconds] as const;
}

export function useAuthFlow() {
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl'));

  const [tab, setTabState] = useState<AuthTab>(searchParams.get('mode') === 'signup' ? 'signup' : 'signin');
  const [mode, setMode] = useState<AuthMode>('form');

  // Sign in
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siError, setSiError] = useState('');
  const [siLoading, setSiLoading] = useState(false);
  /** Success notice on the sign-in screen (verified, password reset, …). */
  const [siNotice, setSiNotice] = useState('');

  // Sign up
  const [suName, setSuName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suError, setSuError] = useState('');
  const [suLoading, setSuLoading] = useState(false);

  // Verify email
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resendSuccess, setResendSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useCountdown();
  const [resendLoading, setResendLoading] = useState(false);

  // Forgot / reset password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useCountdown();

  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

  // Show ?error= from NextAuth redirects (derived during render, not in an effect).
  const errorParam = searchParams.get('error');
  const [seenErrorParam, setSeenErrorParam] = useState<string | null>(null);
  if (errorParam !== seenErrorParam) {
    setSeenErrorParam(errorParam);
    const msg = errorFromParam(errorParam);
    if (msg) {
      setSiError(msg);
      setTabState('signin');
    }
  }

  const setTab = useCallback((next: AuthTab) => {
    setTabState(next);
    setSiError('');
    setSuError('');
  }, []);

  const goToSignIn = useCallback((email?: string) => {
    setMode('form');
    setTabState('signin');
    if (email !== undefined) setSiEmail(email);
  }, []);

  // Show the verify screen for `email` and ask the server for a fresh code.
  const promptVerify = useCallback(
    (email: string, password: string, notice = '') => {
      const clean = normalizeEmail(email);
      setVerifyEmail(clean);
      setVerifyPassword(password);
      setOtp('');
      setVerifyError('');
      setResendSuccess(notice);
      setMode('verify');
      if (!clean) return;
      postJson('/api/auth/resend-code', { email: clean })
        .then(({ ok, json }) => {
          if (ok) {
            setResendSuccess(notice || json.message || 'We sent a verification code to your email.');
            setResendCooldown(RESEND_COOLDOWN_SEC);
          } else if (json.error) {
            setVerifyError(json.error);
          }
        })
        .catch(() => {});
    },
    [setResendCooldown],
  );

  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    setSiError('');
    setSuError('');
    setOauthLoading(provider);
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      setSiError(errorMessages.OAuthSignin);
      setOauthLoading(null);
    }
  };

  const handleSignIn = async () => {
    setSiError('');
    setSiNotice('');
    const invalid = validateSignIn(siEmail, siPassword);
    if (invalid) {
      setSiError(invalid);
      return;
    }
    setSiLoading(true);
    try {
      const res = await signIn('credentials', {
        email: normalizeEmail(siEmail),
        password: siPassword,
        callbackUrl,
        redirect: false,
      });
      if (res?.error) {
        if (res.code === 'email_not_verified') {
          promptVerify(siEmail, siPassword, 'Your email isn’t verified yet. We’ve sent you a new code.');
        } else {
          setSiError(signInErrorMessage(res) ?? errorMessages.Default);
        }
      } else {
        window.location.href = callbackUrl;
      }
    } catch {
      setSiError(errorMessages.Default);
    } finally {
      setSiLoading(false);
    }
  };

  const handleSignUp = async () => {
    setSuError('');
    const invalid = validateSignUp(suEmail, suPassword);
    if (invalid) {
      setSuError(invalid);
      return;
    }
    setSuLoading(true);
    try {
      const { ok, json } = await postJson('/api/auth/signup', {
        name: suName.trim(),
        email: normalizeEmail(suEmail),
        password: suPassword,
      });
      if (!ok) {
        setSuError(json.error ?? 'Sign up failed. Please try again.');
        return;
      }
      // The server answers the same way for new and existing emails.
      setVerifyEmail(normalizeEmail(suEmail));
      setVerifyPassword(suPassword);
      setOtp('');
      setVerifyError('');
      setResendSuccess('');
      setResendCooldown(RESEND_COOLDOWN_SEC);
      setMode('verify');
    } catch {
      setSuError('Something went wrong. Please try again.');
    } finally {
      setSuLoading(false);
    }
  };

  const handleVerifyCode = async (codeToVerify?: string) => {
    const code = codeToVerify || otp;
    const invalid = validateCode(code);
    if (invalid) {
      setVerifyError(invalid);
      return;
    }
    if (verifyLoading) return;
    setVerifyError('');
    setResendSuccess('');
    setVerifyLoading(true);
    try {
      const { ok, json } = await postJson('/api/auth/verify-code', { email: verifyEmail, code });
      if (!ok) {
        setVerifyError(json.error || 'Verification failed. Please check the code.');
        return;
      }
      // Sign straight in if we still have the password from this visit.
      if (verifyPassword) {
        const loginRes = await signIn('credentials', {
          email: verifyEmail,
          password: verifyPassword,
          callbackUrl,
          redirect: false,
        });
        if (loginRes?.error) {
          goToSignIn(verifyEmail);
          setSiNotice('Email verified. Please sign in with your password.');
        } else {
          window.location.href = callbackUrl;
        }
      } else {
        goToSignIn(verifyEmail);
        setSiError('');
        setSiNotice('Email verified. Please sign in.');
      }
    } catch {
      setVerifyError('Something went wrong. Please try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setVerifyError('');
    setResendSuccess('');
    try {
      const { ok, json } = await postJson('/api/auth/resend-code', { email: verifyEmail });
      if (!ok) {
        setVerifyError(json.error || 'Could not resend the code.');
      } else {
        setResendSuccess(json.message || 'A new code is on its way.');
        setResendCooldown(RESEND_COOLDOWN_SEC);
      }
    } catch {
      setVerifyError('Could not resend the code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const openForgot = () => {
    setForgotEmail(siEmail);
    setForgotError('');
    setForgotSuccess('');
    setMode('forgot');
  };

  const sendResetCode = async () => {
    const { ok, json } = await postJson('/api/auth/forgot-password', { email: normalizeEmail(forgotEmail) });
    return { ok, error: json.error, message: json.message };
  };

  const handleRequestPasswordReset = async () => {
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email address.');
      return;
    }
    setForgotError('');
    setForgotSuccess('');
    setForgotLoading(true);
    try {
      const res = await sendResetCode();
      if (!res.ok) {
        setForgotError(res.error || 'Could not send a reset code.');
      } else {
        setForgotSuccess(res.message || 'If an account exists for that email, a reset code is on its way.');
        setForgotCooldown(RESEND_COOLDOWN_SEC);
        setResetOtp('');
        setResetNewPassword('');
        setResetConfirmPassword('');
        setResetError('');
        setMode('reset');
      }
    } catch {
      setForgotError('Something went wrong. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    if (forgotCooldown > 0 || forgotLoading) return;
    setForgotLoading(true);
    setResetError('');
    setForgotSuccess('');
    try {
      const res = await sendResetCode();
      if (!res.ok) {
        setResetError(res.error || 'Could not resend the code.');
      } else {
        setForgotSuccess(res.message || 'A new reset code is on its way.');
        setForgotCooldown(RESEND_COOLDOWN_SEC);
      }
    } catch {
      setResetError('Could not resend the reset code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const invalid = validateReset(resetOtp, resetNewPassword, resetConfirmPassword);
    if (invalid) {
      setResetError(invalid);
      return;
    }
    setResetError('');
    setResetLoading(true);
    try {
      const { ok, json } = await postJson('/api/auth/reset-password', {
        email: normalizeEmail(forgotEmail),
        code: resetOtp,
        newPassword: resetNewPassword,
      });
      if (!ok) {
        setResetError(json.error || 'Could not reset your password.');
      } else {
        goToSignIn(forgotEmail);
        setSiPassword('');
        setSiError('');
        setSiNotice('Password updated. Sign in with your new password.');
      }
    } catch {
      setResetError('Something went wrong. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleNeedVerify = () => {
    if (siEmail.trim()) {
      promptVerify(siEmail, siPassword);
    } else {
      setSiError('Enter the email you signed up with above, then choose “Enter code” again.');
    }
  };

  const backFromVerify = () => {
    setMode('form');
    setVerifyError('');
    setResendSuccess('');
  };

  const backFromForgot = () => {
    setMode('form');
    setForgotError('');
  };

  const backFromReset = () => {
    setMode('forgot');
    setResetError('');
  };

  const isAnyLoading = siLoading || suLoading || verifyLoading || forgotLoading || resetLoading || oauthLoading !== null;

  return {
    callbackUrl,
    tab, setTab, mode, setMode,
    siEmail, setSiEmail, siPassword, setSiPassword, siError, siNotice, siLoading,
    suName, setSuName, suEmail, setSuEmail, suPassword, setSuPassword, suError, suLoading,
    verifyEmail, otp, setOtp, verifyLoading, verifyError, resendSuccess, resendCooldown, resendLoading,
    forgotEmail, setForgotEmail, forgotError, forgotSuccess, forgotLoading, forgotCooldown,
    resetOtp, setResetOtp, resetNewPassword, setResetNewPassword, resetConfirmPassword, setResetConfirmPassword,
    resetError, resetLoading,
    oauthLoading, isAnyLoading,
    handleOAuthSignIn, handleSignIn, handleSignUp, handleVerifyCode, handleResendCode,
    handleRequestPasswordReset, handleResendResetCode, handleResetPassword,
    handleNeedVerify, openForgot, goToSignIn, backFromVerify, backFromForgot, backFromReset,
  };
}

export type AuthFlow = ReturnType<typeof useAuthFlow>;

/** Wrap a handler so it works as a <form onSubmit>. */
export function onSubmit(handler: () => void) {
  return (e: FormEvent) => {
    e.preventDefault();
    handler();
  };
}
