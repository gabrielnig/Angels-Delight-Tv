/**
 * Share targets (L15a). Plain links and the Web Share API only: no third party scripts, pixels or SDKs.
 * The link that is shared is always the clean canonical address, never the address bar and never tagged.
 */
export const SHARE_TARGET_IDS = [
  'copy',
  'whatsapp',
  'facebook',
  'x',
  'telegram',
  'email',
  'sms',
  'more',
] as const;
export type ShareTargetId = (typeof SHARE_TARGET_IDS)[number];

/** The targets that open another app or page through a plain link. */
export type LinkChannel = 'whatsapp' | 'facebook' | 'x' | 'telegram' | 'email' | 'sms';
const LINK_CHANNELS: readonly string[] = ['whatsapp', 'facebook', 'x', 'telegram', 'email', 'sms'];

export interface ShareContent {
  title: string;
  text: string;
  url: string;
}

/** encodeURIComponent leaves ! ' ( ) * alone. Some apps cut a link at those, so they are escaped too. */
function enc(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Cuts text to `max` characters (counting the three dots) without leaving a letter's mark behind. */
export function clampShareText(text: string, max: number): string {
  const chars = [...text.normalize('NFC')];
  if (chars.length <= max) return text;
  let end = max - 3;
  while (end > 0 && /\p{M}/u.test(chars[end] ?? '')) end -= 1;
  return `${chars.slice(0, end).join('').trimEnd()}...`;
}

const TEXT_MAX = 200;

export function targetHref(channel: LinkChannel, input: ShareContent): string {
  const text = clampShareText(input.text, TEXT_MAX);
  const { url } = input;
  switch (channel) {
    case 'whatsapp':
      return `https://wa.me/?text=${enc(`${text} ${url}`)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;
    case 'x':
      return `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`;
    case 'email':
      return `mailto:?subject=${enc(clampShareText(input.title, 120))}&body=${enc(`${text}\n${url}`)}`;
    case 'sms':
      // `sms:?&body=` opens a new message with the text on both iOS and Android.
      return `sms:?&body=${enc(`${text} ${url}`)}`;
  }
}

/**
 * The places the sheet lists, in order: Copy link first, then the channels the admin enabled in their stored
 * order, then More (the device share menu) only when this device has one.
 */
export function sheetTargets(
  channels: readonly ShareTargetId[],
  opts: { nativeShare: boolean },
): ShareTargetId[] {
  const seen = new Set<string>();
  const list: ShareTargetId[] = ['copy'];
  for (const id of channels) {
    if (!LINK_CHANNELS.includes(id) || seen.has(id)) continue;
    seen.add(id);
    list.push(id);
  }
  if (opts.nativeShare) list.push('more');
  return list;
}

export interface CanonicalShareInput {
  /** The site origin from APP_ORIGIN. */
  origin: string;
  kind: 'video' | 'series';
  slug: string;
  /** Seconds. Videos only. */
  startAt?: number;
}

/** `/title/<slug>` or `/series/<slug>` on the public origin, with at most `?t=<whole seconds>`. */
export function canonicalShareUrl(input: CanonicalShareInput): string {
  const origin = input.origin.replace(/\/+$/, '');
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (!origin.startsWith('https://') && !local) throw new Error('Share links need an https origin');
  const path = `${input.kind === 'series' ? '/series/' : '/title/'}${encodeURIComponent(input.slug)}`;
  const t = Math.floor(input.startAt ?? 0);
  return input.kind === 'video' && t > 0 ? `${origin}${path}?t=${t}` : `${origin}${path}`;
}
