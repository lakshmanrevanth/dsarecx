import { Container } from './primitives';

export type ArticleSection = { title: string; body: React.ReactNode };

/** Editorial page for About, Privacy and Terms: eyebrow, serif title, numbered sections. */
export function ArticlePage({
  eyebrow,
  title,
  lede,
  sections,
  children,
  footnote,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede: React.ReactNode;
  sections: ArticleSection[];
  children?: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  return (
    <main id="main" tabIndex={-1} className="pb-28 pt-36 outline-none sm:pt-44">
      <Container>
        <article className="max-w-[760px]">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display mt-6 text-[clamp(48px,8vw,96px)] text-foreground">{title}</h1>
          <p className="mt-8 max-w-[620px] text-[18px] leading-relaxed text-muted-foreground">{lede}</p>

          <ol className="mt-16 border-t border-border">
            {sections.map((s, i) => (
              <li key={s.title} className="grid gap-3 border-b border-border py-8 sm:grid-cols-[64px_1fr]">
                <span className="font-mono text-[12px] text-ember">({String(i + 1).padStart(2, '0')})</span>
                <div>
                  <h2 className="font-serif text-[30px] leading-tight text-foreground">{s.title}</h2>
                  <div className="mt-3 space-y-3 text-[15.5px] leading-relaxed text-muted-foreground">{s.body}</div>
                </div>
              </li>
            ))}
          </ol>

          {children}

          {footnote ? <p className="mt-10 text-[14px] text-muted-foreground">{footnote}</p> : null}
        </article>
      </Container>
    </main>
  );
}
