import { parseTvPreference, resolveTvMode, TV_COOKIE } from './detect';

function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

/**
 * Whether the root layout should set `html[data-tv]`. Reads the Cookie header rather than `cookies()` so the first
 * paint is already at TV size and nothing flashes.
 */
export function tvModeFromHeaders(headers: Headers): boolean {
  const preference = parseTvPreference(cookieValue(headers.get('cookie'), TV_COOKIE));
  return resolveTvMode(preference, headers.get('user-agent'));
}
