'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export type IndicatorSection = { id: string; label: string };

/**
 * Vertical dots on the right edge, one per section; the current one is a
 * short ember bar. Desktop only. Each dot is a real link.
 */
export function SectionIndicator({ sections }: { sections: IndicatorSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.4;
      let current = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [sections]);

  return (
    <nav aria-label="Sections" className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 xl:block">
      <ul className="flex flex-col items-center gap-3">
        {sections.map((s) => {
          const on = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-label={s.label}
                aria-current={on ? 'true' : undefined}
                title={s.label}
                className="group grid h-6 w-4 place-items-center rounded-full"
              >
                <span
                  className={cn(
                    'block w-1.5 rounded-full transition-all duration-300',
                    on ? 'h-5 bg-ember' : 'h-1.5 bg-border-strong group-hover:bg-muted-foreground',
                  )}
                />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
