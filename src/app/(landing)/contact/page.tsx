import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { Container } from '@/components/landing/primitives';
import { ContactForm } from '@/components/landing/contact-form';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Feedback, bug reports or feature requests for ${siteConfig.name}? Get in touch.`,
};

const CHANNELS = [
  { label: 'Email', value: siteConfig.contactEmail, href: `mailto:${siteConfig.contactEmail}` },
  ...(siteConfig.githubUrl
    ? [{ label: 'Issues & pull requests', value: siteConfig.githubUrl.replace(/^https:\/\//, ''), href: `${siteConfig.githubUrl}/issues` }]
    : []),
];

export default function ContactPage() {
  return (
    <main id="main" tabIndex={-1} className="pb-28 pt-36 outline-none sm:pt-44">
      <Container className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="eyebrow">Contact</p>
          <h1 className="display mt-6 text-[clamp(48px,8vw,96px)] text-foreground">
            Say <em>hello.</em>
          </h1>
          <p className="mt-8 max-w-md text-[18px] leading-relaxed text-muted-foreground">
            Found a bug, want a platform supported, or have a question about how the schedule works? A real person reads every
            message.
          </p>

          <ul className="mt-12 border-t border-border">
            {CHANNELS.map((c, i) => (
              <li key={c.label} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-5">
                <span className="flex items-center gap-4">
                  <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[15px] text-foreground">{c.label}</span>
                </span>
                <a
                  href={c.href}
                  target={c.href.startsWith('http') ? '_blank' : undefined}
                  rel={c.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center gap-1 font-mono text-[12.5px] text-muted-foreground hover:text-ember"
                >
                  {c.value} <ArrowUpRight size={13} aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:pt-24">
          <p className="eyebrow eyebrow-plain mb-4">Write a message</p>
          <ContactForm />
        </div>
      </Container>
    </main>
  );
}
