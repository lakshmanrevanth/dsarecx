import type { FormEvent } from 'react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

import {
  errorFromParam,
  errorMessages,
  normalizeEmail,
  onSubmit,
  signInErrorMessage,
  validateCode,
  validateReset,
  validateSignIn,
  validateSignUp,
} from './use-auth-flow';

describe('signInErrorMessage', () => {
  it('returns null on success', () => {
    expect(signInErrorMessage({ error: null })).toBeNull();
    expect(signInErrorMessage(undefined)).toBeNull();
  });
  it('returns null for unverified email (handled by the verify screen)', () => {
    expect(signInErrorMessage({ error: 'CredentialsSignin', code: 'email_not_verified' })).toBeNull();
  });
  it('maps rate limiting to its own message', () => {
    expect(signInErrorMessage({ error: 'CredentialsSignin', code: 'rate_limited' })).toBe(errorMessages.RateLimited);
  });
  it('falls back to invalid email or password', () => {
    expect(signInErrorMessage({ error: 'CredentialsSignin', code: 'credentials' })).toBe(errorMessages.CredentialsSignin);
  });
});

describe('errorFromParam', () => {
  it('is null without a param', () => {
    expect(errorFromParam(null)).toBeNull();
    expect(errorFromParam('')).toBeNull();
  });
  it('maps known NextAuth errors', () => {
    expect(errorFromParam('SessionRequired')).toBe(errorMessages.SessionRequired);
    expect(errorFromParam('OAuthAccountNotLinked')).toBe(errorMessages.OAuthAccountNotLinked);
  });
  it('falls back to the default for unknown or prototype keys', () => {
    expect(errorFromParam('SomethingElse')).toBe(errorMessages.Default);
    expect(errorFromParam('toString')).toBe(errorMessages.Default);
    expect(errorFromParam('__proto__')).toBe(errorMessages.Default);
  });
});

describe('validators', () => {
  it('normalizes emails', () => {
    expect(normalizeEmail('  Me@Example.COM ')).toBe('me@example.com');
  });
  it('requires both sign-in fields', () => {
    expect(validateSignIn('', 'x')).toMatch(/email and password/);
    expect(validateSignIn('a@b.co', '')).toMatch(/email and password/);
    expect(validateSignIn('a@b.co', 'x')).toBeNull();
  });
  it('checks sign-up email and password length', () => {
    expect(validateSignUp('', 'longenough')).toMatch(/email/);
    expect(validateSignUp('not-an-email', 'longenough')).toMatch(/valid email/);
    expect(validateSignUp('a@b.co', 'short')).toMatch(/8 characters/);
    expect(validateSignUp('a@b.co', '12345678')).toBeNull();
  });
  it('accepts only 6-digit codes', () => {
    expect(validateCode('123456')).toBeNull();
    expect(validateCode('12345')).not.toBeNull();
    expect(validateCode('12345a')).not.toBeNull();
    expect(validateCode('1234567')).not.toBeNull();
  });
  it('checks reset code, length and confirmation in order', () => {
    expect(validateReset('12', 'longenough', 'longenough')).toMatch(/6-digit/);
    expect(validateReset('123456', 'short', 'short')).toMatch(/8 characters/);
    expect(validateReset('123456', 'longenough', 'different1')).toMatch(/do not match/);
    expect(validateReset('123456', 'longenough', 'longenough')).toBeNull();
  });
});

describe('onSubmit', () => {
  it('prevents the default form submit and calls the handler', () => {
    const handler = vi.fn();
    const preventDefault = vi.fn();
    onSubmit(handler)({ preventDefault } as unknown as FormEvent);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledOnce();
  });
});
