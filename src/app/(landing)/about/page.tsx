import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { ArticlePage } from '@/components/landing/article-page';

export const metadata: Metadata = {
  title: 'About',
  description: `Why ${siteConfig.name} exists: spaced repetition for the DSA problems and system design concepts you have already learned once.`,
};

const name = siteConfig.name;

export default function AboutPage() {
  return (
    <ArticlePage
      eyebrow={`About ${name}`}
      title={
        <>
          Built for the second
          <br />
          time you <em>see it.</em>
        </>
      }
      lede={`Grinding hundreds of problems feels like progress until an interviewer asks one you solved two months ago and it is a blank. ${name} exists to make the first solve count.`}
      sections={[
        {
          title: 'The forgetting curve',
          body: (
            <p>
              Memory fades fast after you learn something, then more slowly. Without a review, most of a fresh solution is gone within a
              couple of days. Re-solving from scratch weeks later is the expensive way to fix that.
            </p>
          ),
        },
        {
          title: 'Reviews right before it slips',
          body: (
            <p>
              {name} schedules each problem at 3, 7, 14 and 30 days. You recall first, then rate yourself. Clean moves it up the ladder,
              Shaky repeats the step and Struggled starts it again at day 3. The weak ones get the reps; the strong ones get out of
              your way.
            </p>
          ),
        },
        {
          title: 'Code and system design',
          body: (
            <p>
              Add problems from LeetCode, Codeforces, CodeChef, GeeksforGeeks and HackerRank, with over 18,000 indexed so a number or
              URL is enough. System design concepts and learning paths run on the same schedule, with recall questions to answer from
              memory.
            </p>
          ),
        },
        {
          title: 'Open source',
          body: (
            <p>
              {name} is made by {siteConfig.owner}. It is free and open source under {siteConfig.license}, and your data exports in
              full whenever you want it.
            </p>
          ),
        },
      ]}
    >
      <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
        <Link href="/today" className="btn btn-cta">
          Open {name}
          <span className="btn-cta-dot">
            <ArrowUpRight size={18} aria-hidden />
          </span>
        </Link>
        {siteConfig.githubUrl ? (
          <a href={siteConfig.githubUrl} target="_blank" rel="noopener noreferrer" className="link-underline text-[15px] text-foreground">
            Read the source <ArrowUpRight size={14} aria-hidden />
          </a>
        ) : (
          <Link href="/contact" className="link-underline text-[15px] text-foreground">
            Get in touch
          </Link>
        )}
      </div>
    </ArticlePage>
  );
}
