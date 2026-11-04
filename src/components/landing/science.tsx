import { Container, Section, SectionHeading } from './primitives';
import { Reveal } from './reveal';
import { RetentionChart } from './retention-chart';

const FACTS = [
  { value: '~70%', label: 'of a new solution is gone within two days if you never look at it again' },
  { value: '4', label: 'spaced reviews, each further apart, before a problem counts as mastered' },
  { value: '0', label: 'decisions about what to revise today. The queue is already waiting.' },
];

export function Science() {
  return (
    <Section id="science" labelledBy="science-title" className="border-t border-border">
      <Container>
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <SectionHeading
            index="03"
            label="The science"
            id="science-title"
            title={
              <>
                Memory leaks.
                <br />
                Patch it on <em>time.</em>
              </>
            }
            lede="Hermann Ebbinghaus measured it in 1885: what you learn fades fast at first, then slower. Reviewing just as it starts to slip resets the curve and flattens it, so each gap can be longer than the last."
          />
          <dl className="grid gap-6 sm:grid-cols-3 lg:grid-cols-1">
            {FACTS.map((f) => (
              <div key={f.value} className="flex items-baseline gap-5 border-t border-border pt-4">
                <dt className="display w-24 shrink-0 text-[44px] text-foreground">{f.value}</dt>
                <dd className="text-[14px] leading-relaxed text-muted-foreground">{f.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <Reveal className="mt-16">
          <RetentionChart />
        </Reveal>
      </Container>
    </Section>
  );
}
