import type { ShareTargetId } from './share-targets';

/**
 * Glyphs for the share targets, drawn as currentColor SVG so there is no brand colour in the CSS and the sheet
 * follows the theme (D-391). They are original simple marks, not brand artwork.
 */
const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function ShareIcon({ id, size = 26 }: { id: ShareTargetId; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false } as const;
  switch (id) {
    case 'copy':
      return (
        <svg {...common}>
          <path {...STROKE} d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg {...common}>
          <path {...STROKE} d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" />
          <path fill="currentColor" d="M9 8.5c.3 3.3 3.2 6.2 6.5 6.5l1.3-1.6-2.2-1-.9.9c-1-.4-2.1-1.5-2.5-2.5l.9-.9-1-2.2z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg {...common}>
          <path fill="currentColor" d="M13.5 21v-8h2.7l.5-3.2h-3.2V7.9c0-.9.4-1.7 1.8-1.7h1.5V3.4S15.1 3.2 13.9 3.2c-2.6 0-4.1 1.5-4.1 4.3v2.3H7v3.2h2.8v8h3.7z" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common}>
          <path {...STROKE} strokeWidth={2.4} d="M5 4l14 16M19 4L5 20" />
        </svg>
      );
    case 'telegram':
      return (
        <svg {...common}>
          <path fill="currentColor" d="M20.5 4.2L3.4 10.8c-.8.3-.8 1.3 0 1.5l4.3 1.4 1.6 5c.2.6.9.7 1.3.3l2.4-2.2 4.3 3.2c.6.4 1.3.1 1.5-.6l2.9-14c.1-.8-.5-1.4-1.2-1.2zM9 13.4l8.2-5.1-6.5 6.2-.3 2.7z" />
        </svg>
      );
    case 'email':
      return (
        <svg {...common}>
          <rect x="3" y="5.5" width="18" height="13" rx="2" {...STROKE} />
          <path {...STROKE} d="M4 7.5l8 6 8-6" />
        </svg>
      );
    case 'sms':
      return (
        <svg {...common}>
          <path {...STROKE} d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z" />
          <path {...STROKE} d="M8 10h8M8 13h5" />
        </svg>
      );
    case 'more':
      return (
        <svg {...common}>
          <path {...STROKE} d="M12 15V3M8 7l4-4 4 4" />
          <path {...STROKE} d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
        </svg>
      );
  }
}
