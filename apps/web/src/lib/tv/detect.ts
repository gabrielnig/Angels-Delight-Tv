/**
 * TV mode detection (M49-S15). Pure, so the server layout and the settings switch share it.
 * The choice is a cookie, not local storage, so the server draws the first paint at the right size (D-L10 TV).
 */
export const TV_COOKIE = 'ad_tv';
export const TV_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export type TvPreference = 'auto' | 'on' | 'off';

/**
 * Smart TV and streaming stick browsers: Tizen (Samsung), webOS (LG), SmartTV, Android TV, Fire TV (`AFT` model
 * codes), Chromecast (`CrKey`), Hisense and VIDAA. A phone or desktop UA never matches.
 */
const TV_UA =
  /Tizen|Web0S|WebOS|Smart-?TV|\bAndroid TV\b|; AFT[A-Z0-9]{1,5} Build\/|CrKey|Hisense|VIDAA/;

export function isTvBrowser(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent) && TV_UA.test(userAgent as string);
}

export function parseTvPreference(value: unknown): TvPreference {
  return value === 'on' || value === 'off' ? value : 'auto';
}

/** An explicit choice beats the user agent. Auto follows it. */
export function resolveTvMode(
  preference: TvPreference,
  userAgent: string | null | undefined,
): boolean {
  if (preference === 'on') return true;
  if (preference === 'off') return false;
  return isTvBrowser(userAgent);
}
