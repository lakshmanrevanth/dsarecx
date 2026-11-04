'use client';

import { useState } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { siteConfig } from '@/config/site';

/** Builds the mailto: link the form opens. Exported for tests. */
export function buildMailto(name: string, email: string, message: string): string {
  const subject = `${siteConfig.name} message from ${name.trim() || 'a user'}`;
  const body = `Name: ${name.trim()}\nEmail: ${email.trim()}\n\n${message.trim()}`;
  return `mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Contact form. There is no backend for it: submitting opens the visitor's mail
 * app with the message drafted, as before.
 */
export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid email address so we can reply.');
      return;
    }
    if (!message.trim()) {
      setError('Please write a message.');
      return;
    }
    setError('');
    window.location.href = buildMailto(name, email, message);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card p-6 sm:p-8" role="status">
        <p className="flex items-center gap-2 text-[15px] font-medium text-foreground">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-ember-soft text-ember-strong">
            <Check size={14} aria-hidden />
          </span>
          Your mail app should have opened with the message drafted.
        </p>
        <p className="mt-2 text-[14px] text-muted-foreground">
          If nothing happened, email{' '}
          <a href={`mailto:${siteConfig.contactEmail}`} className="text-foreground underline underline-offset-2">
            {siteConfig.contactEmail}
          </a>{' '}
          directly.
        </p>
        <button type="button" className="btn btn-outline mt-6" onClick={() => setSent(false)}>
          Write another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="card space-y-5 p-6 sm:p-8" aria-describedby={error ? 'contact-error' : undefined}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="label">
            Name
          </label>
          <input id="contact-name" name="name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="contact-email" className="label">
            Email <span aria-hidden className="text-ember">*</span>
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            className="field"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label htmlFor="contact-message" className="label">
          Message <span aria-hidden className="text-ember">*</span>
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          className="field"
          placeholder="A bug, an idea, a platform you want supported…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      {error ? (
        <p id="contact-error" role="alert" className="rounded-lg border border-error-border bg-error-bg px-3 py-2 text-[13.5px] text-error">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[13px] text-muted-foreground">Opens your mail app with the message ready to send.</p>
        <button type="submit" className="btn btn-primary btn-lg">
          Send message <ArrowUpRight size={16} aria-hidden />
        </button>
      </div>
    </form>
  );
}
