import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { ArticlePage } from '@/components/landing/article-page';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: `How ${siteConfig.name} handles your account, problem history and revision data.`,
};

const name = siteConfig.name;
const mail = (
  <a href={`mailto:${siteConfig.contactEmail}`} className="text-foreground underline underline-offset-2 hover:text-ember">
    {siteConfig.contactEmail}
  </a>
);

export default function PrivacyPage() {
  return (
    <ArticlePage
      eyebrow="Privacy policy · November 2026"
      title={
        <>
          Only what the
          <br />
          schedule <em>needs.</em>
        </>
      }
      lede={`${name} collects the minimum it needs to sign you in and work out your revision schedule. It does not sell or share your data.`}
      sections={[
        {
          title: 'What we collect',
          body: (
            <>
              <p>
                Your name, email address and avatar when you sign up with email and password or GitHub. Passwords are stored
                only as a salted hash.
              </p>
              <p>
                The problems and concepts you log, your notes and custom columns, each revision and its rating, and preferences such as
                your timezone, daily goal and intervals, plus the problems and concepts you add to your to-learn list.
              </p>
            </>
          ),
        },
        {
          title: 'No third-party credentials',
          body: (
            <p>
              {name} never asks for, sees or stores your passwords or session cookies for LeetCode or any other platform. Problem
              details come from public data.
            </p>
          ),
        },
        {
          title: 'How it is used',
          body: (
            <p>
              Only to run the product: scheduling reviews, building your daily queue, streaks and stats. If you use AI recall
              questions, the problem or concept title is sent to the AI provider to generate them. Nothing is used for advertising.
            </p>
          ),
        },
        {
          title: 'Email',
          body: (
            <p>
              We only send account emails: verification and password-reset codes, and a code to confirm a new email address. Nothing
              is sent on a schedule: no study nudges, digests or marketing emails.
            </p>
          ),
        },
        {
          title: 'Where it lives',
          body: (
            <p>
              The app runs on Vercel over HTTPS and stores data in a managed PostgreSQL database. Aggregate, cookieless analytics may be
              used to count page views.
            </p>
          ),
        },
        {
          title: 'Your data, your call',
          body: (
            <p>
              Export everything as JSON or CSV from Settings whenever you like, and delete your account and all its data from the same
              page. You can also ask us to do it at {mail}.
            </p>
          ),
        },
      ]}
      footnote={<>Questions about this policy? Write to {mail}.</>}
    />
  );
}
