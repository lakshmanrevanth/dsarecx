import { Container, Section, SectionHeading } from './primitives';
import { Reveal } from './reveal';
import { RevisionDemo } from './revision-demo';
import { TableDemo } from './table-demo';

export function QueueSection() {
  return (
    <Section id="queue" labelledBy="queue-title" className="border-t border-border">
      <Container>
        <SectionHeading
          index="04"
          label="The daily queue"
          id="queue-title"
          title={
            <>
              Ten minutes.
              <br />
              Every <em>morning.</em>
            </>
          }
          lede="Open Daily and everything due is waiting, weakest first. Recall before you peek, rate honestly, and each button tells you when it comes back. Try it: click a row, or use the keyboard."
        />
        <Reveal className="mt-14">
          <RevisionDemo />
        </Reveal>
      </Container>
    </Section>
  );
}

export function TrackerSection() {
  return (
    <Section id="tracker" labelledBy="tracker-title" className="border-t border-border">
      <Container>
        <SectionHeading
          index="05"
          label="The tracker"
          id="tracker-title"
          title={
            <>
              A table that
              <br />
              fills <em>itself.</em>
            </>
          }
          lede="Notion-style and inline: type a number and the row appears with title, difficulty and topic. Add your own columns for patterns, complexity or the company that asked it."
        />
        <Reveal className="mt-14">
          <TableDemo />
        </Reveal>
      </Container>
    </Section>
  );
}
