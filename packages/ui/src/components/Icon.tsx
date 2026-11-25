import type { SVGProps } from 'react';

/**
 * One outline icon set, 24px grid, 1.5px stroke, drawn as inline SVG with currentColor
 * (docs/DESIGN-SYSTEM.md section 9). Paths are original line drawings.
 */
const PATHS = {
  play: 'M8 5.5v13l11-6.5z',
  pause: 'M8 5v14M16 5v14',
  volumeOff: 'M4 9.5h3.5L12 5.5v13L7.5 14.5H4zM16 9.5l5 5M21 9.5l-5 5',
  volumeOn: 'M4 9.5h3.5L12 5.5v13L7.5 14.5H4zM15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.5 16.5L21 21',
  back: 'M15 5l-7 7 7 7',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  chevronDown: 'M5 9l7 7 7-7',
  menu: 'M4 7h16M4 12h16M4 17h16',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff:
    'M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.1 3.7M6.5 7.6A16.8 16.8 0 0 0 2 12s4 6 10 6a9.4 9.4 0 0 0 4-.9',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 20c0-4 3.6-6 8-6s8 2 8 6',
  users:
    'M9 5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 19c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 6a3 3 0 0 1 0 6M18 14c2.2.6 3.5 2.2 3.5 5',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01',
  warning: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  error: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9l6 6M15 9l-6 6',
  success: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l3 3 5-6',
  wifiOff:
    'M3 3l18 18M2 9a15 15 0 0 1 5-3M22 9a15 15 0 0 0-8-4M5.5 12.5a10 10 0 0 1 3-2M18.5 12.5a10 10 0 0 0-3-2M9 16a5 5 0 0 1 6 0M12 20h.01',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  home: 'M4 11l8-7 8 7M6 10v10h12V10',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  shield: 'M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z',
  retry: 'M20 5v5h-5M4 19v-5h5M18.5 10A7 7 0 0 0 6 7.5M5.5 14A7 7 0 0 0 18 16.5',
  settings:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8',
  captions: 'M3 6h18v12H3zM8 11.5a2 2 0 1 0 0 1M16 11.5a2 2 0 1 0 0 1',
  share: 'M12 4v11M8 8l4-4 4 4M5 13v7h14v-7',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  dataSaver: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 14l3-3 2 2 3-4',
  thumbUp:
    'M7 11v9H4v-9zM7 11l4-7c1.7 0 2.5 1.2 2.2 2.8L12.7 9H19a1.8 1.8 0 0 1 1.8 2.2l-1.4 6.5A2.5 2.5 0 0 1 17 19.5H7',
  thumbDown:
    'M7 13V4H4v9zM7 13l4 7c1.7 0 2.5-1.2 2.2-2.8L12.7 15H19a1.8 1.8 0 0 0 1.8-2.2l-1.4-6.5A2.5 2.5 0 0 0 17 4.5H7',
  heart: 'M12 20s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.2 12 20 12 20z',
  bell: 'M6 17h12l-1.5-2.5V10a4.5 4.5 0 0 0-9 0v4.5zM10 20a2 2 0 0 0 4 0',
  sort: 'M8 5v14M8 19l-3-3M8 19l3-3M16 19V5M16 5l-3 3M16 5l3 3',
  filter: 'M4 6h16M7 12h10M10 18h4',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6',
} as const;

export type IconName = keyof typeof PATHS;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** Filled shapes such as play look better solid. */
  filled?: boolean;
}

export function Icon({ name, size = 24, filled = false, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
