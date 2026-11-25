import type { Block, CalloutKind, Inline } from '@ad/help';
import Link from 'next/link';
import { Icon } from '../Icon';

/** Pictures are private files served to signed in staff only (M50-S07). */
export const mediaUrl = (src: string): string => `/admin/help/media/img/${src}`;

const CALLOUT_WORDS: Record<CalloutKind, { word: string; icon: 'info' | 'alert' | 'star' }> = {
  tip: { word: 'Tip', icon: 'star' },
  careful: { word: 'Careful', icon: 'alert' },
  note: { word: 'Note', icon: 'info' },
};

export function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case 'text':
            return n.v;
          case 'code':
            return <code key={i}>{n.v}</code>;
          case 'strong':
            return (
              <strong key={i}>
                <Inlines nodes={n.c} />
              </strong>
            );
          case 'em':
            return (
              <em key={i}>
                <Inlines nodes={n.c} />
              </em>
            );
          case 'link': {
            if (n.kind === 'external') {
              return (
                <a key={i} href={n.href} target="_blank" rel="noreferrer noopener">
                  <Inlines nodes={n.c} />
                  <span className="adm-sr"> (opens in a new tab)</span>
                </a>
              );
            }
            const href =
              n.kind === 'help'
                ? `/admin/help/${n.href}`
                : n.kind === 'glossary'
                  ? `/admin/help/glossary#${n.href}`
                  : n.href;
            return (
              <Link key={i} href={href}>
                <Inlines nodes={n.c} />
              </Link>
            );
          }
        }
      })}
    </>
  );
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'p':
            return (
              <p key={i}>
                <Inlines nodes={b.c} />
              </p>
            );
          case 'ul':
          case 'ol': {
            const Tag = b.t;
            return (
              <Tag key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inlines nodes={item.c} />
                    {item.note ? (
                      <span className="hlp-note">
                        <Inlines nodes={item.note} />
                      </span>
                    ) : null}
                    {item.blocks.length ? <Blocks blocks={item.blocks} /> : null}
                  </li>
                ))}
              </Tag>
            );
          }
          case 'callout': {
            const { word, icon } = CALLOUT_WORDS[b.kind];
            return (
              <aside key={i} className={`hlp-callout hlp-callout--${b.kind}`}>
                <Icon name={icon} size={18} />
                <p>
                  <strong>{word}:</strong> <Inlines nodes={b.c} />
                </p>
              </aside>
            );
          }
          case 'image':
            return (
              <figure key={i} className="hlp-figure">
                {/* eslint-disable-next-line @next/next/no-img-element -- private route, fixed size set by CSS */}
                <img src={mediaUrl(b.src)} alt={b.alt} loading="lazy" decoding="async" />
              </figure>
            );
        }
      })}
    </>
  );
}
