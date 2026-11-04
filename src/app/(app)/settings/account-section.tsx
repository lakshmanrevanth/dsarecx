'use client';

// Settings "Account" section (sign-in methods, password, email change) and the
// separate "Danger zone" (account deletion).

import { useCallback, useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { KeyRound, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Row, Section, StatusText, requestJson, useSaveState } from './ui';

type AccountInfo = {
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  providers: string[];
};

const PROVIDER_LABELS: Record<string, string> = { google: 'Google', github: 'GitHub' };
const providerLabel = (p: string) => PROVIDER_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1);

// Browser-side copies of preferences, cleared when the account is deleted.
const LOCAL_KEYS = ['recall_daily_target', 'recall_default_platform', 'dsarecx_daily_target', 'dsarecx_default_platform'];

export function AccountSection({
  index,
  onEmailChanged,
}: {
  index: number;
  onEmailChanged: (email: string) => void;
}) {
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setInfo(await requestJson<AccountInfo>('/api/account'));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load account details');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  const body = loadError ? (
    <div role="alert" className="flex flex-wrap items-center gap-3 py-5 text-[13.5px] text-error">
      {loadError}
      <button type="button" className="btn btn-outline btn-sm" onClick={load}>
        Retry
      </button>
    </div>
  ) : !info ? (
    <div className="grid gap-3 py-5" role="status" aria-label="Loading account">
      <div className="skeleton h-5 w-40" />
      <div className="skeleton h-10" />
      <div className="skeleton h-10" />
    </div>
  ) : null;

  return (
    <>
      <Section
        index={index}
        id="account"
        title="Account"
        description="How you sign in, your password and the email address on your account."
      >
        {body ?? (
          <>
            <SignInMethods info={info!} onChange={load} />
            <PasswordForm info={info!} onChange={load} />
            <EmailChange
              info={info!}
              onChanged={(email) => {
                onEmailChanged(email);
                void load();
              }}
            />
          </>
        )}
      </Section>

      <Section index={index + 1} id="danger-zone" title="Danger zone" tone="danger">
        {body ?? <DeleteAccount email={info!.email} />}
      </Section>
    </>
  );
}

function SignInMethods({ info, onChange }: { info: AccountInfo; onChange: () => void }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const save = useSaveState();
  const methodCount = info.providers.length + (info.hasPassword ? 1 : 0);

  const unlink = async (provider: string) => {
    const ok = await save.run(
      () => requestJson(`/api/account/providers/${encodeURIComponent(provider)}`, { method: 'DELETE' }),
      `${providerLabel(provider)} unlinked`
    );
    setConfirming(null);
    if (ok) onChange();
  };

  return (
    <Row
      label="Sign-in methods"
      align="start"
      wide
      description={
        methodCount <= 1 && info.providers.length > 0
          ? 'Set a password below before unlinking your only sign-in provider.'
          : 'Unlink a provider you no longer use. You always keep at least one way in.'
      }
    >
      <ul className="overflow-hidden rounded-lg border border-border bg-card">
        {info.hasPassword && (
          <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span className="inline-flex items-center gap-2.5 text-[14px] text-foreground">
              <KeyRound size={16} strokeWidth={1.75} className="text-muted-foreground" aria-hidden />
              Email and password
            </span>
            <span className="min-w-0 truncate font-mono text-[11.5px] text-faint">{info.email}</span>
          </li>
        )}
        {info.providers.map((p) => (
          <li key={p} className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 first:border-t-0">
            <span className="inline-flex items-center gap-2.5 text-[14px] text-foreground">
              <span className="grid h-4 w-4 place-items-center font-mono text-[10px] text-muted-foreground" aria-hidden>
                {providerLabel(p).charAt(0)}
              </span>
              {providerLabel(p)}
            </span>
            {confirming === p ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] text-muted-foreground">Unlink {providerLabel(p)}?</span>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => unlink(p)}
                  disabled={save.state.status === 'saving'}
                >
                  {save.state.status === 'saving' ? 'Unlinking…' : 'Unlink'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(null)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setConfirming(p)}
                disabled={methodCount <= 1}
                title={methodCount <= 1 ? 'This is your only way to sign in' : undefined}
                aria-label={`Unlink ${providerLabel(p)}`}
              >
                Unlink
              </button>
            )}
          </li>
        ))}
      </ul>
      <StatusText state={save.state} className="mt-2" />
    </Row>
  );
}

function PasswordForm({ info, onChange }: { info: AccountInfo; onChange: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [needsReauth, setNeedsReauth] = useState(false);
  const save = useSaveState();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNeedsReauth(false);
    if (info.hasPassword && !current) return save.fail('Enter your current password');
    if (next.length < 8) return save.fail('New password must be at least 8 characters');
    if (next !== confirm) return save.fail('The new passwords do not match');

    const ok = await save.run(
      async () => {
        try {
          return await requestJson('/api/account/password', {
            method: 'POST',
            body: JSON.stringify(info.hasPassword ? { currentPassword: current, newPassword: next } : { newPassword: next }),
          });
        } catch (err) {
          if ((err as { code?: string }).code === 'REAUTH_REQUIRED') setNeedsReauth(true);
          throw err;
        }
      },
      info.hasPassword ? 'Password changed. Other sessions were signed out.' : 'Password set. You can now sign in with your email.'
    );

    if (ok) {
      // Changing the password ends older sessions, so get a fresh one for this tab.
      const res = await signIn('credentials', { email: info.email, password: next, redirect: false }).catch(() => undefined);
      if (!res || res.error) save.fail('Password saved. You will be asked to sign in again shortly.');
      setCurrent('');
      setNext('');
      setConfirm('');
      onChange();
    }
  };

  return (
    <Row
      label={info.hasPassword ? 'Change password' : 'Set a password'}
      align="start"
      wide
      description={
        info.hasPassword
          ? 'Other signed-in sessions end within a few minutes.'
          : `You sign in with ${info.providers.map(providerLabel).join(' or ') || 'a provider'}. Add a password to also sign in with your email. You must have signed in within the last 10 minutes.`
      }
    >
      <form onSubmit={submit} noValidate className="grid gap-4">
        {/* Helps password managers pair the new password with the account. */}
        <input type="email" name="username" autoComplete="username" value={info.email} readOnly hidden />
        {info.hasPassword && (
          <div>
            <label htmlFor="current-password" className="label">
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="field"
            />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="new-password" className="label">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              aria-describedby="new-password-hint"
              className="field"
            />
            <p id="new-password-hint" className="mt-1.5 text-[12px] text-faint">
              At least 8 characters.
            </p>
          </div>
          <div>
            <label htmlFor="confirm-password" className="label">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="field"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-outline" disabled={save.state.status === 'saving'}>
            {save.state.status === 'saving' ? 'Saving…' : info.hasPassword ? 'Change password' : 'Set password'}
          </button>
          <StatusText state={save.state} />
        </div>
        {needsReauth && info.providers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {info.providers.map((p) => (
              <button
                key={p}
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => signIn(p, { callbackUrl: '/settings#account' })}
              >
                Sign in again with {providerLabel(p)}
              </button>
            ))}
          </div>
        )}
      </form>
    </Row>
  );
}

function EmailChange({ info, onChanged }: { info: AccountInfo; onChanged: (email: string) => void }) {
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const { update: updateSession } = useSession();
  const save = useSaveState();

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return save.fail('Enter a valid email address');
    const ok = await save.run(
      () => requestJson('/api/account/email', { method: 'POST', body: JSON.stringify({ newEmail: email }) }),
      `Code sent to ${email}`
    );
    if (ok) setCodeSentTo(email);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeSentTo) return;
    if (!/^\d{6}$/.test(code.trim())) return save.fail('Enter the 6-digit code');
    const ok = await save.run(
      () =>
        requestJson<{ email: string }>('/api/account/email/verify', {
          method: 'POST',
          body: JSON.stringify({ newEmail: codeSentTo, code: code.trim() }),
        }),
      'Email changed. Use the new address next time you sign in.'
    );
    if (ok) {
      onChanged(ok.email);
      // Refresh the session so it carries the new email.
      await updateSession().catch(() => undefined);
      setCodeSentTo(null);
      setNewEmail('');
      setCode('');
    }
  };

  return (
    <Row
      label="Change email"
      align="start"
      wide
      description={
        <>
          Current: <span className="break-all text-foreground">{info.email}</span>. We send a 6-digit code to the new address; your email
          only changes after you enter it.
        </>
      }
    >
      {!codeSentTo ? (
        <form onSubmit={sendCode} noValidate className="flex flex-wrap gap-2">
          <label htmlFor="new-email" className="sr-only">
            New email address
          </label>
          <div className="relative min-w-[200px] flex-1">
            <Mail size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
            <input
              id="new-email"
              type="email"
              autoComplete="email"
              placeholder="new@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="field pl-9"
            />
          </div>
          <button type="submit" className="btn btn-outline" disabled={save.state.status === 'saving' || !newEmail.trim()}>
            {save.state.status === 'saving' ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} noValidate className="grid gap-2">
          <label htmlFor="email-code" className="label">
            Code sent to <span className="normal-case tracking-normal text-foreground">{codeSentTo}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="email-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="field w-36 font-mono tracking-[0.3em]"
            />
            <button type="submit" className="btn btn-primary" disabled={save.state.status === 'saving'}>
              {save.state.status === 'saving' ? 'Checking…' : 'Confirm new email'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setCodeSentTo(null);
                setCode('');
                save.reset();
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <StatusText state={save.state} className="mt-2" />
    </Row>
  );
}

function DeleteAccount({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const save = useSaveState();
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  const remove = async () => {
    const ok = await save.run(
      () => requestJson('/api/account', { method: 'DELETE', body: JSON.stringify({ confirmEmail: typed.trim() }) }),
      'Account deleted'
    );
    if (ok) {
      try {
        for (const k of LOCAL_KEYS) localStorage.removeItem(k);
      } catch {
        // ignore
      }
      await signOut({ callbackUrl: '/' });
    }
  };

  return (
    <Row
      label="Delete account"
      align="start"
      wide
      description="Permanently deletes your account, problems, concepts, notes, revision history, lists and streaks. This cannot be undone. Export your data first if you want a copy."
    >
      {!open ? (
        <button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>
          Delete account…
        </button>
      ) : (
        <div role="group" aria-labelledby="delete-confirm-label" className="grid gap-3 rounded-lg border border-error-border bg-card p-4">
          <label id="delete-confirm-label" htmlFor="delete-confirm" className="text-[13.5px] text-foreground">
            Type <strong className="break-all font-mono text-[12.5px] font-medium">{email}</strong> to confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className={cn('field', matches && 'border-error')}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-danger" onClick={remove} disabled={!matches || save.state.status === 'saving'}>
              {save.state.status === 'saving' ? 'Deleting…' : 'Permanently delete my account'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setOpen(false);
                setTyped('');
                save.reset();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <StatusText state={save.state} className="mt-2" />
    </Row>
  );
}
