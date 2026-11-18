'use client';

import { useState } from 'react';
import { Icon } from '@ad/ui';

/** Three lines at the page width. Longer text collapses behind Show more (M07-S01, S18). */
const COLLAPSE_AFTER = 140;

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
          <span>{open ? 'Show less' : 'Show more'}</span>
          <Icon name="chevronDown" size={16} className="web-expandable__chevron" />
        </button>
      ) : null}
    </div>
  );
}
