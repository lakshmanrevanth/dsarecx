import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { ArticlePage } from '@/components/landing/article-page';

export const metadata: Metadata = {
  title: 'Terms of service',
  description: `The terms for using ${siteConfig.name}.`,
};

const name = siteConfig.name;
const mail = (
  <a href={`mailto:${siteConfig.contactEmail}`} className="text-foreground underline underline-offset-2 hover:text-ember">
    {siteConfig.contactEmail}
  </a>
);

export default function TermsPage() {
  return (
    <ArticlePage
      eyebrow="Terms of service · November 2026"
      title={
        <>
          The short,
          <br />
          plain <em>version.</em>
        </>
      }
      lede={`These terms cover your use of ${name}. Please read them before you use the service.`}
      sections={[
        {
          title: 'Agreement',
          body: (
            <p>
              By using {name} at {siteConfig.host} you agree to these terms. If you do not agree, please do not use the service.
            </p>
          ),
        },
        {
          title: 'A free service',
          body: (
            <p>
              {name} is free for individuals preparing for technical interviews and practising data structures, algorithms and system
              design. Features may change over time.
            </p>
          ),
        },
        {
          title: 'Not affiliated',
          body: (
            <p>
              {name} is an independent, open-source project. It is not affiliated with, endorsed by or sponsored by LeetCode, Codeforces,
              CodeChef, GeeksforGeeks or HackerRank. Their names and marks belong to their owners. Learning-path articles link to their
              original authors.
            </p>
          ),
        },
        {
          title: 'Acceptable use',
          body: (
            <p>
              Don&apos;t try to disrupt the service, get around its rate limits, access other people&apos;s accounts, or send automated
              traffic at it. Keep your password safe; you are responsible for activity on your account.
            </p>
          ),
        },
        {
          title: 'Your content',
          body: (
            <p>
              The notes and data you add stay yours. You give us permission only to store and process them to run the service for you.
            </p>
          ),
        },
        {
          title: 'No warranty',
          body: (
            <p>
              {name} is provided “as is”, without warranties of any kind. To the extent the law allows, its maintainers are not liable for
              any damages from using it. Keep your own exports of anything important.
            </p>
          ),
        },
      ]}
      footnote={<>Questions about these terms? Write to {mail}.</>}
    />
  );
}
