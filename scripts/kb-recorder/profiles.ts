/** Recording profiles: viewport sizes and the burned in caption geometry for each. Pure data, no browser code. */
export interface Profile {
  name: 'desktop' | 'mobile';
  width: number;
  height: number;
  mobile: boolean;
  captionFontSize: number;
  captionMarginX: number;
  captionMarginV: number;
}

export const PROFILES: Record<Profile['name'], Profile> = {
  desktop: {
    name: 'desktop',
    width: 1280,
    height: 720,
    mobile: false,
    captionFontSize: 34,
    captionMarginX: 96,
    captionMarginV: 44,
  },
  mobile: {
    name: 'mobile',
    width: 390,
    height: 844,
    mobile: true,
    captionFontSize: 22,
    captionMarginX: 24,
    captionMarginV: 64,
  },
};
