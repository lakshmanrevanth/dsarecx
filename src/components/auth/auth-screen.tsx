'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Brand } from '@/components/brand';
import { siteConfig } from '@/config/site';
import { ThemeSwitch } from '@/components/landing/theme-switch';
import { cn } from '@/lib/utils';
import { OtpInput } from './otp-input';
import { Field, Notice, PasswordField, SubmitButton, TextButton } from './fields';
import { OAuthButtons, OrDivider } from './oauth-buttons';
import { MIN_PASSWORD, onSubmit, useAuthFlow, validateCode, type AuthFlow, type AuthTab } from './use-auth-flow';

/**
 * The whole login experience. One layout for every width: from lg up a paper
 * panel with the tagline sits beside the form; below that the form stands alone.
 */
export function AuthScreen() {
  const flow = useAuthFlow();
  const reduce = useReducedMotion();
  // Tabs switch in place; only a change of screen (verify, forgot, reset) animates.
  const screenKey = flow.mode;
  const [lastKey, setLastKey] = useState(screenKey);
  const [moved, setMoved] = useState(false);
  if (lastKey !== screenKey) {
    setLastKey(screenKey);
    setMoved(true);
  }

  return (
    <div className="paper grain relative grid min-h-[100dvh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Left: editorial panel */}
      <aside className="relative hidden flex-col justify-between border-r border-border px-[92px] py-12 lg:flex">
        <Brand />
        <div>
          <p className="eyebrow">(00) Welcome back</p>
          <p className="display mt-6 text-[clamp(64px,7vw,112px)] text-foreground">
            {siteConfig.taglineLines.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
            <em className="ember-glow block">{siteConfig.taglineAccent}</em>
          </p>
          <div aria-hidden className="mt-10 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>Solve</span>
            {['+3', '+7', '+14', '+30'].map((d, i, a) => (
              <span key={d} className="flex items-center gap-3">
                <span className="h-px w-6 bg-border-strong" />
                <span className={i === a.length - 1 ? 'text-ember-strong' : ''}>{d}</span>
              </span>
            ))}
          </div>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
          {siteConfig.name} · free &amp; open source · {siteConfig.license}
        </p>
      </aside>

      {/* Right: form */}
      <div className="relative flex flex-col px-4 pb-10 pt-6 sm:px-8">
        <div className="flex items-center justify-between lg:justify-end">
          <span className="lg:hidden">
            <Brand />
          </span>
          <div className="flex items-center gap-1">
            <Link href="/" className="btn btn-ghost btn-sm">
              <ArrowLeft size={14} aria-hidden /> Home
            </Link>
            <ThemeSwitch />
          </div>
        </div>

        <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center py-10 outline-none">
          <div className="w-full max-w-[420px]">
            <FocusContext.Provider value={moved}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={screenKey}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                {flow.mode === 'verify' ? (
                  <VerifyScreen flow={flow} />
                ) : flow.mode === 'forgot' ? (
                  <ForgotScreen flow={flow} />
                ) : flow.mode === 'reset' ? (
                  <ResetScreen flow={flow} />
                ) : (
                  <FormScreen flow={flow} />
                )}
              </motion.div>
            </AnimatePresence>
            </FocusContext.Provider>
          </div>
        </main>

        <p className="text-center text-[12px] leading-relaxed text-muted-foreground">
          By continuing you agree to the{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/** True once the visitor has moved past the first screen. */
const FocusContext = createContext(false);

function Heading({ eyebrow, title, children }: { eyebrow: string; title: React.ReactNode; children?: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const moved = useContext(FocusContext);
  // When the screen changes, the button that was pressed is gone. Put focus on
  // the new heading (unless a field on the new screen already took it).
  useEffect(() => {
    if (!moved) return;
    const active = document.activeElement;
    if (!active || active === document.body) ref.current?.focus();
  }, [moved]);
  return (
    <div className="mb-7">
      <p className="eyebrow">{eyebrow}</p>
      <h1 ref={ref} tabIndex={-1} className="display mt-4 text-[52px] text-foreground outline-none sm:text-[60px]">
        {title}
      </h1>
      {children ? <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{children}</p> : null}
    </div>
  );
}

const TABS: { id: AuthTab; label: string }[] = [
  { id: 'signin', label: 'Sign in' },
  { id: 'signup', label: 'Create account' },
];

function Tabs({ flow }: { flow: AuthFlow }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="tablist" aria-label="Sign in or create an account" className="mb-7 grid grid-cols-2 rounded-full border border-border bg-card/70 p-1">
      {TABS.map((t, i) => {
        const active = flow.tab === t.id;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active}
            aria-controls={`panel-${t.id}`}
            tabIndex={active ? 0 : -1}
            disabled={flow.isAnyLoading}
            onClick={() => flow.setTab(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const next = TABS[(i + 1) % TABS.length];
                flow.setTab(next.id);
                refs.current[(i + 1) % TABS.length]?.focus();
              }
            }}
            className={cn(
              'h-9 rounded-full text-[14px] font-medium transition-colors',
              active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function FormScreen({ flow }: { flow: AuthFlow }) {
  const signin = flow.tab === 'signin';
  return (
    <>
      <Heading
        eyebrow={signin ? '(01) Sign in' : '(01) Create account'}
        title={signin ? <>Welcome <em>back.</em></> : <>Start <em>remembering.</em></>}
      >
        {signin ? 'Your queue is waiting where you left it.' : 'Free, open source, and set up in a minute.'}
      </Heading>

      <Tabs flow={flow} />

      {signin ? (
        <div role="tabpanel" id="panel-signin" aria-labelledby="tab-signin">
          <Notice error={flow.siError} success={flow.siNotice} />
          <form onSubmit={onSubmit(flow.handleSignIn)} noValidate className="space-y-4">
            <Field
              id="signin-email"
              label="Email"
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              required
              value={flow.siEmail}
              onChange={flow.setSiEmail}
              placeholder="you@example.com"
              aria-invalid={!!flow.siError || undefined}
            />
            <PasswordField
              id="signin-password"
              label="Password"
              name="password"
              autoComplete="current-password"
              required
              value={flow.siPassword}
              onChange={flow.setSiPassword}
              aria-invalid={!!flow.siError || undefined}
              action={
                <TextButton onClick={flow.openForgot} className="text-[12.5px] font-normal text-muted-foreground">
                  Forgot password?
                </TextButton>
              }
            />
            <SubmitButton loading={flow.siLoading} disabled={flow.isAnyLoading}>
              Sign in <ArrowRight size={16} aria-hidden />
            </SubmitButton>
          </form>
          <p className="mt-4 text-center text-[13px] text-muted-foreground">
            Signed up but never verified?{' '}
            <TextButton onClick={flow.handleNeedVerify} disabled={flow.isAnyLoading}>
              Enter code
            </TextButton>
          </p>
          <OrDivider />
          <OAuthButtons flow={flow} />
        </div>
      ) : (
        <div role="tabpanel" id="panel-signup" aria-labelledby="tab-signup">
          <Notice error={flow.suError} />
          <form onSubmit={onSubmit(flow.handleSignUp)} noValidate className="space-y-4">
            <Field
              id="signup-name"
              label="Name (optional)"
              name="name"
              autoComplete="name"
              value={flow.suName}
              onChange={flow.setSuName}
              placeholder="Ada Lovelace"
            />
            <Field
              id="signup-email"
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              required
              value={flow.suEmail}
              onChange={flow.setSuEmail}
              placeholder="you@example.com"
            />
            <PasswordField
              id="signup-password"
              label="Password"
              name="new-password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD}
              value={flow.suPassword}
              onChange={flow.setSuPassword}
              hint={`At least ${MIN_PASSWORD} characters.`}
            />
            <SubmitButton loading={flow.suLoading} disabled={flow.isAnyLoading}>
              Create account <ArrowRight size={16} aria-hidden />
            </SubmitButton>
          </form>
          <p className="mt-4 text-center text-[13px] text-muted-foreground">We&apos;ll email you a 6-digit code to confirm it&apos;s you.</p>
          <OrDivider />
          <OAuthButtons flow={flow} />
        </div>
      )}
    </>
  );
}

function BackLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="btn btn-ghost btn-sm -ml-3 mb-6">
      <ArrowLeft size={14} aria-hidden /> {children}
    </button>
  );
}

function ResendRow({ cooldown, loading, onResend }: { cooldown: number; loading: boolean; onResend: () => void }) {
  return (
    <p className="mt-5 text-center text-[13px] text-muted-foreground" aria-live="polite">
      Didn&apos;t get it?{' '}
      {cooldown > 0 ? (
        <span>
          Resend in <span className="font-mono text-foreground">{cooldown}s</span>
        </span>
      ) : (
        <TextButton onClick={onResend} disabled={loading}>
          {loading ? 'Sending…' : 'Resend code'}
        </TextButton>
      )}
    </p>
  );
}

function VerifyScreen({ flow }: { flow: AuthFlow }) {
  return (
    <>
      <BackLink onClick={flow.backFromVerify}>Back</BackLink>
      <Heading eyebrow="(02) Verify email" title={<>Check your <em>inbox.</em></>}>
        We sent a 6-digit code to <strong className="font-medium text-foreground">{flow.verifyEmail || 'your email'}</strong>. It
        expires soon, so enter it below.
      </Heading>
      <Notice id="verify-notice" error={flow.verifyError} success={flow.resendSuccess} />
      <form onSubmit={onSubmit(() => flow.handleVerifyCode())} noValidate>
        <p id="verify-code-label" className="label">
          Verification code
        </p>
        <OtpInput
          value={flow.otp}
          onChange={flow.setOtp}
          onComplete={(code) => flow.handleVerifyCode(code)}
          disabled={flow.verifyLoading}
          error={!!flow.verifyError}
          labelledBy="verify-code-label"
          describedBy="verify-notice"
          idPrefix="verify"
        />
        <SubmitButton className="mt-6" loading={flow.verifyLoading} disabled={validateCode(flow.otp) !== null}>
          Verify and continue
        </SubmitButton>
      </form>
      <ResendRow cooldown={flow.resendCooldown} loading={flow.resendLoading} onResend={flow.handleResendCode} />
      <p className="mt-3 text-center text-[12.5px] text-muted-foreground">
        Wrong email? <TextButton onClick={() => flow.setMode('form')} className="text-[12.5px]">Change it</TextButton>
        {' · '}Already verified?{' '}
        <TextButton onClick={() => flow.goToSignIn(flow.verifyEmail)} className="text-[12.5px]">
          Sign in
        </TextButton>
      </p>
    </>
  );
}

function ForgotScreen({ flow }: { flow: AuthFlow }) {
  return (
    <>
      <BackLink onClick={flow.backFromForgot}>Back to sign in</BackLink>
      <Heading eyebrow="(02) Reset password" title={<>Forgot it? <em>Happens.</em></>}>
        Enter the email you signed up with and we&apos;ll send you a 6-digit reset code.
      </Heading>
      <Notice error={flow.forgotError} />
      <form onSubmit={onSubmit(flow.handleRequestPasswordReset)} noValidate className="space-y-4">
        <Field
          id="forgot-email"
          label="Email"
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          required
          autoFocus
          value={flow.forgotEmail}
          onChange={flow.setForgotEmail}
          placeholder="you@example.com"
        />
        <SubmitButton loading={flow.forgotLoading} disabled={!flow.forgotEmail.trim()}>
          Send reset code
        </SubmitButton>
      </form>
    </>
  );
}

function ResetScreen({ flow }: { flow: AuthFlow }) {
  return (
    <>
      <BackLink onClick={flow.backFromReset}>Change email</BackLink>
      <Heading eyebrow="(03) New password" title={<>Choose a new <em>one.</em></>}>
        Enter the code sent to <strong className="font-medium text-foreground">{flow.forgotEmail}</strong> and pick a new password.
      </Heading>
      <Notice id="reset-notice" error={flow.resetError} success={flow.forgotSuccess} />
      <form onSubmit={onSubmit(flow.handleResetPassword)} noValidate className="space-y-4">
        {/* Lets password managers attach the new password to the right account. */}
        <input type="email" name="email" autoComplete="username" value={flow.forgotEmail} readOnly hidden />
        <div>
          <p id="reset-code-label" className="label">
            Reset code
          </p>
          <OtpInput
            value={flow.resetOtp}
            onChange={flow.setResetOtp}
            disabled={flow.resetLoading}
            error={!!flow.resetError && validateCode(flow.resetOtp) !== null}
            labelledBy="reset-code-label"
            describedBy="reset-notice"
            idPrefix="reset"
          />
        </div>
        <PasswordField
          id="reset-password"
          label="New password"
          name="new-password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={flow.resetNewPassword}
          onChange={flow.setResetNewPassword}
          hint={`At least ${MIN_PASSWORD} characters.`}
        />
        <PasswordField
          id="reset-confirm"
          label="Confirm new password"
          name="confirm-password"
          autoComplete="new-password"
          required
          value={flow.resetConfirmPassword}
          onChange={flow.setResetConfirmPassword}
        />
        <SubmitButton loading={flow.resetLoading} disabled={validateCode(flow.resetOtp) !== null || !flow.resetNewPassword || !flow.resetConfirmPassword}>
          Update password
        </SubmitButton>
      </form>
      <ResendRow cooldown={flow.forgotCooldown} loading={flow.forgotLoading} onResend={flow.handleResendResetCode} />
    </>
  );
}
