import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Container } from './primitives';
import { Reveal } from './reveal';

export function FinalCTA() {
  return (
    <section id="start" aria-labelledby="cta-title" data-landing-section className="scroll-mt-24 border-t border-border py-28 sm:py-40">
      <Container>
        <Reveal className="text-center">
          <p className="eyebrow">(08) Start today</p>
          <h2 id="cta-title" className="display mx-auto mt-6 max-w-4xl text-[clamp(52px,9vw,124px)] text-foreground">
            Your next interview
            <br />
            starts <em className="ember-glow">now.</em>
          </h2>
          <p className="mx-auto mt-8 max-w-md text-[17px] leading-relaxed text-muted-foreground">
            Log the problem you solved today. In three days, it will be waiting for you.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-5">
            <Link href="/today" className="btn btn-cta">
              Start revising
              <span className="btn-cta-dot">
                <ArrowUpRight size={18} aria-hidden />
              </span>
            </Link>
            <Link href="/auth/login" className="link-underline text-[15px] text-foreground">
              I already have an account
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
