import {
  BookOpen,
  CalendarCheck,
  Columns3,
  Download,
  Flame,
  Focus,
  Layers,
  ListChecks,
  LineChart,
  NotebookPen,
  ScanSearch,
  Sparkles,
  Table2,
  type LucideIcon,
} from 'lucide-react';
import { siteConfig } from '@/config/site';
import { Container, GitHubIcon, Section, SectionHeading } from './primitives';
import { Reveal } from './reveal';

type Feature = { icon: LucideIcon | 'github'; title: string; body: string };

const FEATURES: Feature[] = [
  {
    icon: ScanSearch,
    title: 'Five platforms, 18k+ problems',
    body: 'LeetCode, Codeforces, CodeChef, GeeksforGeeks and HackerRank. Metadata fills from a local index, with a live LeetCode fallback.',
  },
  {
    icon: Table2,
    title: 'Notion-style table',
    body: 'Click a cell to edit, Enter to save. Filter by platform, topic, tag, overdue or list, and group however you like.',
  },
  {
    icon: Columns3,
    title: 'Custom columns',
    body: 'Text, select, date, checkbox and link columns, per account, with no setup. Rename, reorder, delete.',
  },
  {
    icon: ListChecks,
    title: 'Lists',
    body: 'Keep Blind 75, NeetCode 150 or your own sheet as named lists, and bulk-add problems to them.',
  },
  {
    icon: CalendarCheck,
    title: 'Daily queue',
    body: 'Everything due, weakest first. Lateness shown, snooze or retire from the row menu, undo every rating.',
  },
  {
    icon: Focus,
    title: 'Focus mode & shortcuts',
    body: 'One item at a time with f. Then j/k, Space, 1·2·3 and u. Press ? for the full list.',
  },
  {
    icon: Flame,
    title: 'Streaks & heatmap',
    body: 'A year of activity at a glance, in your own timezone. Optionally count a day only when the goal is met.',
  },
  {
    icon: LineChart,
    title: 'Stats',
    body: 'Retention by topic, ratings over time and what is coming due, so you know where you are weak.',
  },
  {
    icon: BookOpen,
    title: 'System design paths',
    body: '7 learning paths and a library of 58 concepts. Mark an article learned and it joins the same schedule.',
  },
  {
    icon: Sparkles,
    title: 'AI recall questions',
    body: 'Questions to answer from memory before you reveal your notes, generated for problems and concepts.',
  },
  {
    icon: NotebookPen,
    title: 'Today & To-learn list',
    body: 'One page for what you learned today, what is due, and a backlog of problems and concepts to learn next.',
  },
  {
    icon: Download,
    title: 'Import & export',
    body: 'Bring a CSV or Excel sheet and map its columns. Export a full JSON backup that restores everything.',
  },
  {
    icon: 'github',
    title: 'Open source',
    body: `${siteConfig.license}, free, and self-hostable. Your data is yours to take with you.`,
  },
  {
    icon: Layers,
    title: 'Your intervals',
    body: 'The 3·7·14·30 ladder is a default. Change all four steps and the daily goal in Settings.',
  },
];

export function Capabilities() {
  return (
    <Section id="features" labelledBy="features-title" className="border-t border-border">
      <Container>
        <SectionHeading
          index="06"
          label="Everything in it"
          id="features-title"
          title={
            <>
              Small tool.
              <br />
              No <em>gaps.</em>
            </>
          }
          lede="Everything you need to keep hundreds of problems warm, and nothing that asks for your attention when nothing is due."
        />

        <ul className="mt-16 grid border-t border-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal
                as="li"
                key={f.title}
                delay={(i % 3) * 0.04}
                className="group border-b border-border py-7 sm:pr-10"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-muted-foreground transition-colors group-hover:text-ember">
                    {Icon === 'github' ? <GitHubIcon size={16} /> : <Icon size={16} strokeWidth={1.75} aria-hidden />}
                  </span>
                </div>
                <h3 className="mt-3 text-[17px] font-medium text-foreground">{f.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{f.body}</p>
              </Reveal>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
