/**
 * Share links (M45-S06). The channel tag `s` is for first party counts of where shares go and is never part of the
 * canonical address (the canonical is the page path alone).
 */
export type ShareChannelId = 'whatsapp' | 'facebook' | 'x' | 'telegram' | 'email' | 'sms';

export const CHANNEL_TAGS = {
  whatsapp: 'wa',
  facebook: 'fb',
  x: 'x',
  telegram: 'tg',
  email: 'em',
  sms: 'sm',
  copy: 'cp',
  native: 'nt',
} as const;

export function withChannelTag(url: string, tag: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('s', tag);
  return parsed.toString();
}

export interface ShareInput {
  title: string;
  text: string;
  url: string;
}

export function shareHref(channel: ShareChannelId, input: ShareInput): string {
  const url = withChannelTag(input.url, CHANNEL_TAGS[channel]);
  const enc = encodeURIComponent;
  switch (channel) {
    case 'whatsapp':
      return `https://wa.me/?text=${enc(`${input.text} ${url}`)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;
    case 'x':
      return `https://x.com/intent/post?text=${enc(input.text)}&url=${enc(url)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${enc(url)}&text=${enc(input.text)}`;
    case 'sms':
      return `sms:?&body=${enc(`${input.text} ${url}`)}`;
    case 'email':
      return `mailto:?subject=${enc(input.title)}&body=${enc(`${input.text}\n${url}`)}`;
  }
}
