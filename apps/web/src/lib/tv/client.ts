import {
  isTvBrowser,
  parseTvPreference,
  resolveTvMode,
  TV_COOKIE,
  TV_COOKIE_MAX_AGE,
  type TvPreference,
} from './detect';

/** Fired on window when the switch changes, so TvNav follows without a reload. */
export const TV_EVENT = 'ad:tv-mode';

export function readTvPreference(): TvPreference {
  const hit = document.cookie.split(';').find((p) => p.trim().startsWith(`${TV_COOKIE}=`));
  return parseTvPreference(hit ? hit.trim().slice(TV_COOKIE.length + 1) : undefined);
}

/** Stores the choice in a cookie, so the server draws the next page at the right size, and applies it live. */
export function setTvPreference(preference: TvPreference): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie =
    preference === 'auto'
      ? `${TV_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
      : `${TV_COOKIE}=${preference}; Path=/; Max-Age=${TV_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  const root = document.documentElement;
  if (resolveTvMode(preference, navigator.userAgent)) root.setAttribute('data-tv', 'on');
  else root.removeAttribute('data-tv');
  window.dispatchEvent(new Event(TV_EVENT));
}

export { isTvBrowser };
