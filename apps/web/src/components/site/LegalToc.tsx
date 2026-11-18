'use client';

import { useEffect, useState } from 'react';

/** The "On this page" list. The section being read is filled, following the scroll position. */
export function LegalToc({ sections }: { sections: Array<{ id: string; heading: string }> }) {
  const [active, setActive] = useState(sections[0]?.id ?? '');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) seen.add(entry.target.id);
          else seen.delete(entry.target.id);
        }
        const first = sections.find((s) => seen.has(s.id));
        if (first) setActive(first.id);
      },
      { rootMargin: '0px 0px -60% 0px' },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);
  return (
    <nav aria-label="On this page" className="acct-toc">
      <span className="acct-toc__label">On this page</span>
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="acct-toc__link"
          aria-current={s.id === active ? 'location' : undefined}
          onClick={() => setActive(s.id)}
        >
          {s.heading}
        </a>
      ))}
    </nav>
  );
}
