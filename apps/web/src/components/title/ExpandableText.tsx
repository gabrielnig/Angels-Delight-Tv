'use client';

import { useState } from 'react';

/** About 4 lines at the page width. Longer text collapses behind More (M07-S01). */
const COLLAPSE_AFTER = 240;

export function ExpandableText({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > COLLAPSE_AFTER;
  const collapsed = long && !open;
  return (
    <div className={className}>
      <p
        data-testid="expandable-text"
        data-collapsed={collapsed ? 'true' : 'false'}
        className="web-expandable"
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          className="web-expandable__toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Less' : 'More'}
        </button>
      ) : null}
    </div>
  );
}
