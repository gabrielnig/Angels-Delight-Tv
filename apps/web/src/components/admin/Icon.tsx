import type { SVGProps } from 'react';

const PATHS = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  video: 'M3 6h13v12H3zM16 10l5-3v10l-5-3',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  encoding: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01',
  captions: 'M3 5h18v14H3zM7 11h4M7 15h2M13 11h4M13 15h4',
  series: 'M4 8h16v12H4zM6 4h12M8 1h8',
  categories: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  home: 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
  theme:
    'M12 3a9 9 0 100 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a3 3 0 003-3c0-5-4-9-8-9zM8 11h.01M12 7h.01M16 9h.01',
  users:
    'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M17 4a4 4 0 010 7M22 21v-1a5 5 0 00-4-5',
  analytics: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  audit: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
  roles: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 00-2.2-1.3L14 3h-4l-.3 2.4a7 7 0 00-2.2 1.3l-2.4-1-2 3.4 2 1.6a7 7 0 000 2.6l-2 1.6 2 3.4 2.4-1a7 7 0 002.2 1.3L10 21h4l.3-2.4a7 7 0 002.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z',
  system: 'M4 5h16v10H4zM8 19h8M12 15v4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
  bell: 'M6 16V11a6 6 0 0112 0v5l2 2H4zM10 21h4',
  check: 'M5 12l5 5 9-10',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  retry: 'M4 12a8 8 0 018-8 8 8 0 016 3M20 4v4h-4M20 12a8 8 0 01-8 8 8 8 0 01-6-3M4 20v-4h4',
  down: 'M6 9l6 6 6-6',
  up: 'M6 15l6-6 6 6',
  right: 'M9 6l6 6-6 6',
  left: 'M15 6l-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  drag: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeoff:
    'M3 3l18 18M10 6a9 9 0 012-.1c6 0 10 7 10 7a17 17 0 01-3 3.6M6.6 6.6A17 17 0 002 13s4 7 10 7a9 9 0 003.4-.7',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  file: 'M6 3h9l4 4v14H6zM14 3v5h5',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 018 0v4',
  logout: 'M9 4H4v16h5M16 8l4 4-4 4M20 12H9',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21v-1a8 8 0 0116 0v1',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  image: 'M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6M8 9h.01',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  scissors: 'M6 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM8 8l12 10M8 16L20 6',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  mobile: 'M7 2h10v20H7zM11 18h2',
  desktop: 'M3 4h18v12H3zM8 20h8M12 16v4',
  key: 'M8 15a4 4 0 110-8 4 4 0 010 8zM12 11h9v3M18 11v3',
  mail: 'M3 5h18v14H3zM3 7l9 6 9-6',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  film: 'M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** Set when the icon is the only content of a control. Otherwise it is decorative. */
  label?: string;
}

export function Icon({ name, size = 20, label, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
