'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { Container } from './primitives';
import { HeroCard } from './hero-card';
import { PLATFORMS } from './demo-data';

export function Hero() {
  const reduce = useReducedMotion();
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <section id="intro" aria-labelledby="hero-title" data-landing-section className="relative overflow-hidden pb-20 pt-32 sm:pt-40">
      {/* A few warm embers, bottom right. Decorative only. */}
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,hsl(16_100%_56%/0.14),transparent)]" />

      <Container className="grid items-center gap-16 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
        <div>
          <motion.p className="eyebrow" {...rise(0)}>
            (01) Spaced repetition for DSA
          </motion.p>

          {/* Not animated: it is the largest paint and should show before hydration. */}
          <h1 id="hero-title" className="display mt-6 text-[clamp(48px,7.4vw,124px)] text-foreground">
            {siteConfig.taglineLines.map((line) => (
              <span key={line} className="block md:whitespace-nowrap">
                {line}
              </span>
            ))}
            <em className="ember-glow block pr-4">{siteConfig.taglineAccent}</em>
          </h1>

          <motion.p className="mt-8 max-w-[520px] text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]" {...rise(0.15)}>
            You solved it in March. By the interview in May it&apos;s gone. {siteConfig.name} brings each problem and
            system design concept back on day 3, 7, 14 and 30, right before you would forget it.
          </motion.p>

          <motion.div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5" {...rise(0.22)}>
            <Link href="/today" className="btn btn-cta">
              Start revising
              <span className="btn-cta-dot">
                <ArrowUpRight size={18} aria-hidden />
              </span>
            </Link>
            <a href="#how" className="link-underline text-[15px] text-foreground">
              See how it works <ArrowDown size={15} aria-hidden />
            </a>
          </motion.div>

          <motion.p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-faint" {...rise(0.28)}>
            Free · open source · no credit card
          </motion.p>
        </div>

        <motion.div
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, y: 24, rotate: 1 },
                animate: { opacity: 1, y: 0, rotate: 0 },
                transition: { duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] as const },
              })}
        >
          <HeroCard />
        </motion.div>
      </Container>

      {/* Platforms strip */}
      <Container className="mt-24">
        <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            18,000+ problems indexed across
          </p>
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {PLATFORMS.map((p) => (
              <li key={p.name} className="flex items-center gap-2 text-[14px] text-muted-foreground">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.logo} alt="" width={18} height={18} className={p.logoDark ? 'platform-logo-light h-[18px] w-[18px]' : 'h-[18px] w-[18px]'} />
                {p.logoDark ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logoDark} alt="" width={18} height={18} className="platform-logo-dark h-[18px] w-[18px]" />
                ) : null}
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
