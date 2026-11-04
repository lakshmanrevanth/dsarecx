import Link from 'next/link';
import { Brand } from '@/components/brand';
import { siteConfig } from '@/config/site';
import { Container, GitHubIcon } from './primitives';

const COLUMNS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/#how', label: 'How it works' },
      { href: '/#science', label: 'The science' },
      { href: '/#features', label: 'Features' },
      { href: '/#faq', label: 'FAQ' },
    ],
  },
  {
    title: 'App',
    links: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/daily', label: 'Daily review' },
      { href: '/concepts', label: 'System design' },
      { href: '/auth/login', label: 'Sign in' },
    ],
  },
  {
    title: 'About',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-background/60 pb-10 pt-16 backdrop-blur-[1px]">
      <Container>
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Brand size="md" />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-muted-foreground">{siteConfig.tagline}</p>
            <div className="mt-6 flex items-center gap-4 text-[13px] text-muted-foreground">
              <a href={`mailto:${siteConfig.contactEmail}`} className="hover:text-foreground">
                {siteConfig.contactEmail}
              </a>
              {siteConfig.githubUrl ? (
                <a
                  href={siteConfig.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${siteConfig.name} source code on GitHub`}
                  className="hover:text-foreground"
                >
                  <GitHubIcon size={16} />
                </a>
              ) : null}
            </div>
          </div>
          {COLUMNS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[14px] text-muted-foreground transition-colors hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-border pt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-faint sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {year}{' '}
            <a href={siteConfig.ownerGithubUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
              {siteConfig.owner} (@{siteConfig.ownerGithub})
            </a>{' '}
            · {siteConfig.license}
          </span>
          <span>Not affiliated with LeetCode or any platform listed</span>
        </div>
      </Container>
    </footer>
  );
}
