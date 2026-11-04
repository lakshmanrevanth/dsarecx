import { Container, Section, SectionHeading } from './primitives';
import { Reveal } from './reveal';
import { LADDER_DAYS } from './demo-data';

const STEPS = [
  {
    n: '01',
    title: 'Log it once.',
    body: 'Type a LeetCode number, a Codeforces code or paste a URL. Title, difficulty and topics fill themselves in. Finished a system design article? Mark it learned.',
  },
  {
    n: '02',
    title: 'Recall, then rate.',
    body: 'When it comes due, try to answer from memory first. Reveal your notes, then tell us honestly: Clean, Shaky or Struggled.',
  },
  {
    n: '03',
    title: 'The gap grows.',
    body: 'Clean moves it up the ladder. Shaky repeats the step. Struggled sends it back to day 3. After 30 days clean it is mastered, with a 90-day recheck.',
  },
];

const RULES = [
  { rating: 'Clean', chip: 'chip-success', effect: 'Next step up the ladder', detail: '3d → 7d → 14d → 30d → mastered' },
  { rating: 'Shaky', chip: 'chip-warning', effect: 'Same interval again', detail: 'No progress lost, no progress made' },
  { rating: 'Struggled', chip: 'chip-error', effect: 'Back to day 3', detail: 'Weak memories get the most reps' },
];

export function HowItWorks() {
  return (
    <Section id="how" labelledBy="how-title">
      <Container>
        <SectionHeading
          index="02"
          label="How it works"
          id="how-title"
          title={
            <>
              Four reviews.
              <br />
              Then it&apos;s <em>yours.</em>
            </>
          }
          lede="No decks to build and no cards to write. You keep solving problems the way you already do; dsarecx decides when each one comes back."
        />

        {/* The ladder */}
        <Reveal className="mt-16">
          <div className="card relative overflow-hidden p-6 sm:p-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">The revision ladder · days after you solve it</p>
            <ol className="mt-8 grid grid-cols-2 gap-y-10 sm:grid-cols-5">
              <li className="relative">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Day 0</span>
                <p className="display mt-2 text-[56px] text-foreground sm:text-[72px]">Solve</p>
              </li>
              {LADDER_DAYS.map((d, i) => (
                <li key={d} className="relative sm:border-l sm:border-border sm:pl-6">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Review {i + 1}</span>
                  <p className="display mt-2 text-[56px] text-foreground sm:text-[72px]">
                    {i === LADDER_DAYS.length - 1 ? <em>+{d}</em> : <>+{d}</>}
                  </p>
                  <span className="text-[13px] text-muted-foreground">{i === LADDER_DAYS.length - 1 ? 'then mastered' : 'days later'}</span>
                </li>
              ))}
            </ol>
            {/* Rising rule under the ladder */}
            <svg aria-hidden viewBox="0 0 1000 60" preserveAspectRatio="none" className="mt-8 h-12 w-full text-ember">
              <path d="M0 55 C 200 55, 260 45, 360 38 S 620 22, 760 12 S 920 4, 1000 3" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </svg>
            <p className="mt-2 text-[13px] text-muted-foreground">Intervals are adjustable per account in Settings.</p>
          </div>
        </Reveal>

        {/* Three steps */}
        <ol className="mt-20 grid gap-12 md:grid-cols-3 md:gap-10">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.n} delay={i * 0.06} className="border-t border-foreground/80 pt-5">
              <span className="font-mono text-[12px] text-ember">({s.n})</span>
              <h3 className="display mt-3 text-[36px] text-foreground">{s.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
            </Reveal>
          ))}
        </ol>

        {/* Rating rules */}
        <Reveal className="mt-20">
          <table className="table-paper w-full">
            <caption className="sr-only">What each rating does</caption>
            <thead>
              <tr>
                <th scope="col" className="w-[140px] py-3 pr-4">You rate</th>
                <th scope="col" className="py-3 pr-4">What happens</th>
                <th scope="col" className="hidden py-3 sm:table-cell">Why</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((r) => (
                <tr key={r.rating}>
                  <td className="py-4 pr-4">
                    <span className={`chip ${r.chip}`}>{r.rating}</span>
                  </td>
                  <td className="py-4 pr-4 text-[15px] text-foreground">{r.effect}</td>
                  <td className="hidden py-4 font-mono text-[12px] text-muted-foreground sm:table-cell">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </Container>
    </Section>
  );
}
