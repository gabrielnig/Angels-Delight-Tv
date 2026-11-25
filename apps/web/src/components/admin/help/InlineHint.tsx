'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { articleHref } from '@/lib/admin/help-map';
import { Icon } from '../Icon';
import { useHelpPanel } from './HelpPanelHost';

/**
 * The inline hint pattern (S197). Anything a person needs to fill the field correctly stays visible as help text.
 * A hint only adds the why: two lines at most, then one Learn more link to the exact section of a guide. The button
 * is 44 px, names its field, and sets aria-expanded. Nothing opens on hover. Learn more opens the guide in the side
 * panel so the form is kept, and is a plain link when there is no panel.
 */
export function InlineHint({
  field,
  guide,
  section,
  learnMore,
  children,
}: {
  field: string;
  guide: string;
  section?: string;
  /** Finishes "Learn more: ...", for example "change the site name". */
  learnMore: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useHelpPanel();
  return (
    <span
      className="hlp-hint"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className="hlp-hint__button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Help for ${field}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="help" size={20} />
      </button>
      <span id={id} className="hlp-hint__body" hidden={!open}>
        <span className="hlp-hint__text">{children}</span>
        <a
          href={articleHref(guide, section)}
          onClick={(e) => {
            if (!panel.available || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            panel.open({ guide, section });
          }}
        >
          Learn more: {learnMore}
        </a>
      </span>
    </span>
  );
}
