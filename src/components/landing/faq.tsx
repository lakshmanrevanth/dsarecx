import { Plus } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { Container, Section, SectionHeading } from './primitives';

const name = siteConfig.name;

export const FAQS: { q: string; a: string }[] = [
  {
    q: `How does ${name} decide when a problem is due?`,
    a: 'Every problem climbs a ladder: 3, 7, 14 and 30 days. Clean moves it up a step, Shaky repeats the same interval, Struggled sends it back to day 3. After a clean 30-day review it is mastered and comes back once more for a 90-day recheck. Intervals are counted from the day you actually reviewed, and you can change all four in Settings.',
  },
  {
    q: 'Which platforms are supported?',
    a: 'LeetCode, Codeforces, CodeChef, GeeksforGeeks and HackerRank. Over 18,000 problems are indexed, so a number, code or URL fills in the title, difficulty and topics. LeetCode also falls back to a live lookup for brand-new problems. Anything that does not resolve can be typed in by hand.',
  },
  {
    q: 'Does it work for system design, too?',
    a: 'Yes. Follow one of 7 learning paths or pick from a library of 58 concepts. When you mark one as learned it joins the same schedule, with recall questions to answer from memory before you look at your notes.',
  },
  {
    q: 'Is it free?',
    a: `Yes, with no card and no paid tier. ${name} is open source under ${siteConfig.license}, so you can also run your own copy.`,
  },
  {
    q: 'Why not just a spreadsheet or a Notion database?',
    a: `A spreadsheet stores what you solved; it does not tell you what to look at today. ${name} keeps the table you are used to, then adds the scheduling, history, streaks and a daily queue on top, so the deciding is done for you.`,
  },
  {
    q: 'What happens if I miss a few days?',
    a: 'Nothing is lost. Overdue items stay in the queue, weakest first and 20 at a time, until you get to them, and each one is rescheduled from the day you review it. Only the streak counter resets.',
  },
  {
    q: 'Can I bring my existing list?',
    a: 'Yes. Import a CSV or Excel file, map its columns, and choose how the imported problems are scheduled. You can export a full JSON backup at any time and restore it later, with skip, merge or overwrite.',
  },
  {
    q: 'Will it email me?',
    a: 'Only for your account: a code to verify your email and a code if you reset your password. Nothing on a schedule, no digests, no newsletters. Open the Today page when you want to study.',
  },
];

/** Native <details> accordion: keyboard and screen-reader friendly with no script. */
export function FAQ() {
  return (
    <Section id="faq" labelledBy="faq-title" className="border-t border-border">
      <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading
          index="07"
          label="Questions"
          id="faq-title"
          title={
            <>
              Asked &amp;
              <br />
              <em>answered.</em>
            </>
          }
          lede={
            <>
              Something else?{' '}
              <a className="link-underline text-foreground" href="/contact">
                Write to us
              </a>
              .
            </>
          }
        />
        <div className="border-t border-border">
          {FAQS.map((f, i) => (
            <details key={f.q} className="group border-b border-border" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-start gap-4 py-5 text-left [&::-webkit-details-marker]:hidden">
                <span className="mt-1 font-mono text-[11px] text-faint">{String(i + 1).padStart(2, '0')}</span>
                <span className="flex-1 text-[17px] font-medium text-foreground">{f.q}</span>
                <Plus
                  size={18}
                  aria-hidden
                  className="mt-1 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45 group-open:text-ember"
                />
              </summary>
              <p className="pb-6 pl-9 pr-8 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
