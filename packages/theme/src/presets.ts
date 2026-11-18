import { DEFAULT_THEME, type ThemeValues } from './model';

export interface ThemePreset {
  key: string;
  label: string;
  description: string;
  theme: ThemeValues;
}

const make = (colors: Partial<ThemeValues['colors']>, rest: Partial<ThemeValues> = {}): ThemeValues => ({
  ...DEFAULT_THEME,
  ...rest,
  colors: { ...DEFAULT_THEME.colors, ...colors },
});

/**
 * Ready made starting points for the admin theme editor. Each one passes the contrast gate with no warnings, so an
 * admin can publish it as it is. They only set values the editor already owns, nothing here is client specific.
 */
export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    key: 'default',
    label: 'Default',
    description: 'Off white with a calm blue',
    theme: DEFAULT_THEME,
  },
  {
    key: 'sky-blue',
    label: 'Sky blue',
    description: 'Fresh and open',
    theme: make({
      bg: '#EFF6FC',
      ink: '#12212F',
      muted: '#4A5B6C',
      border: '#BFD3E4',
      primary: '#1A6FB8',
      accent: '#7CC4F2',
    }),
  },
  {
    key: 'turquoise',
    label: 'Turquoise',
    description: 'Cool and bright',
    theme: make({
      bg: '#EEF8F7',
      ink: '#10272A',
      muted: '#476266',
      border: '#BEDAD7',
      primary: '#0E7C7B',
      accent: '#4FD1C5',
    }),
  },
  {
    key: 'lemon-green',
    label: 'Lemon green',
    description: 'Lively and natural',
    theme: make({
      bg: '#F6F9EA',
      ink: '#1E2410',
      muted: '#566040',
      border: '#CFD9B0',
      primary: '#4D7C0F',
      accent: '#BEE35B',
    }),
  },
  {
    key: 'sunny-yellow',
    label: 'Sunny yellow',
    description: 'Warm and cheerful',
    theme: make({
      bg: '#FFFBEB',
      ink: '#271F05',
      muted: '#6B5B1E',
      border: '#E6D48F',
      primary: '#92560A',
      accent: '#FFC93C',
    }),
  },
  {
    key: 'lavender',
    label: 'Lavender',
    description: 'Soft and gentle',
    theme: make({
      bg: '#F5F2FB',
      ink: '#1F1A2E',
      muted: '#5B5470',
      border: '#D2C9E8',
      primary: '#6D4FC2',
      accent: '#C4B0F2',
    }),
  },
];

export function findPreset(key: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.key === key);
}
