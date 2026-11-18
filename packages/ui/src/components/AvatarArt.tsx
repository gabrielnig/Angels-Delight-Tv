import type { ReactNode } from 'react';
import type { AvatarTone } from './Avatar';

/**
 * Twelve original profile pictures (M03-S03). Profiles store only the id, so the artwork can be
 * redrawn or replaced later without a data change. Shapes use currentColor (ink), the surface
 * token and the accent token, so they follow the theme. The ids match AVATAR_IDS in @ad/viewer.
 */
export const AVATAR_ART_IDS = [
  'sun',
  'moon',
  'star',
  'leaf',
  'drum',
  'book',
  'kite',
  'bird',
  'fish',
  'tree',
  'cloud',
  'spark',
] as const;
export type AvatarArtId = (typeof AVATAR_ART_IDS)[number];

const ACCENT = 'var(--color-accent)';
const PAPER = 'var(--color-surface)';

interface Art {
  label: string;
  tone: AvatarTone;
  shapes: ReactNode;
}

export const AVATAR_ART: Record<AvatarArtId, Art> = {
  sun: {
    label: 'Sun',
    tone: 'lemon',
    shapes: (
      <>
        <circle cx="32" cy="32" r="12" fill={ACCENT} stroke="currentColor" strokeWidth="2.5" />
        <path
          d="M32 10v6M32 48v6M10 32h6M48 32h6M16.5 16.5l4.2 4.2M43.3 43.3l4.2 4.2M47.5 16.5l-4.2 4.2M20.7 43.3l-4.2 4.2"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
  moon: {
    label: 'Moon',
    tone: 'lavender',
    shapes: (
      <>
        <path
          d="M40 12a20 20 0 1 0 12 30A16 16 0 0 1 40 12z"
          fill={ACCENT}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle cx="50" cy="16" r="2" fill="currentColor" />
        <circle cx="54" cy="26" r="1.5" fill="currentColor" />
      </>
    ),
  },
  star: {
    label: 'Star',
    tone: 'sky',
    shapes: (
      <path
        d="M32 9l7.2 14.6 16.1 2.3-11.7 11.4 2.8 16L32 45.7 17.6 53.3l2.8-16L8.7 25.9l16.1-2.3z"
        fill={ACCENT}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    ),
  },
  leaf: {
    label: 'Leaf',
    tone: 'mint',
    shapes: (
      <>
        <path
          d="M14 50C12 28 28 12 52 12c0 24-14 40-34 38z"
          fill={PAPER}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M14 50L40 24"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
  drum: {
    label: 'Drum',
    tone: 'peach',
    shapes: (
      <>
        <path
          d="M14 26v18c0 4 8 8 18 8s18-4 18-8V26"
          fill={ACCENT}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <ellipse
          cx="32"
          cy="26"
          rx="18"
          ry="7"
          fill={PAPER}
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          d="M18 31l8 18M46 31l-8 18M32 33v19"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M20 8l10 12M44 8L34 20"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
  book: {
    label: 'Book',
    tone: 'sky',
    shapes: (
      <>
        <path
          d="M10 16c8-3 15-2 22 3 7-5 14-6 22-3v31c-8-3-15-2-22 3-7-5-14-6-22-3z"
          fill={PAPER}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M32 19v31" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <path
          d="M16 25c4-1 8 0 11 2M16 32c4-1 8 0 11 2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
  kite: {
    label: 'Kite',
    tone: 'peach',
    shapes: (
      <>
        <path
          d="M32 8l16 18-16 22-16-22z"
          fill={ACCENT}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M32 8v40M16 26h32" stroke="currentColor" strokeWidth="2" fill="none" />
        <path
          d="M32 48c-4 4 4 6 0 10"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
  bird: {
    label: 'Bird',
    tone: 'sky',
    shapes: (
      <>
        <path
          d="M12 38c0-12 9-20 20-20 4 0 7 2 9 4l9 2-8 5c-1 10-8 17-18 17-8 0-12-3-12-8z"
          fill={ACCENT}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle cx="38" cy="25" r="2" fill="currentColor" />
        <path
          d="M20 40c4 4 10 4 14-1"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
  fish: {
    label: 'Fish',
    tone: 'mint',
    shapes: (
      <>
        <path
          d="M8 32c8-12 22-16 34-8l10-6v28l-10-6C30 48 16 44 8 32z"
          fill={ACCENT}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle cx="21" cy="30" r="2" fill="currentColor" />
        <path
          d="M30 26c3 4 3 8 0 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
  tree: {
    label: 'Tree',
    tone: 'mint',
    shapes: (
      <>
        <path d="M29 38h6v16h-6z" fill="currentColor" />
        <circle cx="32" cy="26" r="14" fill={PAPER} stroke="currentColor" strokeWidth="2.5" />
        <circle cx="24" cy="30" r="6" fill={ACCENT} stroke="currentColor" strokeWidth="2" />
        <circle cx="39" cy="22" r="5" fill={ACCENT} stroke="currentColor" strokeWidth="2" />
      </>
    ),
  },
  cloud: {
    label: 'Cloud',
    tone: 'sky',
    shapes: (
      <>
        <path
          d="M18 44a10 10 0 0 1-1-20 14 14 0 0 1 27-2 9 9 0 0 1 2 22z"
          fill={PAPER}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M22 52l-2 5M32 52l-2 5M42 52l-2 5"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
  spark: {
    label: 'Spark',
    tone: 'lemon',
    shapes: (
      <>
        <path
          d="M32 8c2 14 6 18 20 20-14 2-18 6-20 20-2-14-6-18-20-20 14-2 18-6 20-20z"
          fill={ACCENT}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M50 8v8M46 12h8"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
};

export function isAvatarArtId(id: string | undefined): id is AvatarArtId {
  return id !== undefined && (AVATAR_ART_IDS as readonly string[]).includes(id);
}

export function AvatarArtSvg({ id, size }: { id: AvatarArtId; size: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className="ad-avatar__art"
    >
      {AVATAR_ART[id].shapes}
    </svg>
  );
}
