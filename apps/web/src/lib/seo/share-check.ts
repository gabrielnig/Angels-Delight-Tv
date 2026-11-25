/**
 * Pure checks behind `pnpm share:check` (lane L15b): read the share tags of a page and the facts of its picture and
 * list what a platform would complain about. No network here, so every rule is unit tested; the script fetches.
 */

export interface HeadTags {
  meta: Map<string, string[]>;
  canonical?: string;
  robots?: string;
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&#x27;': "'", '&#39;': "'", '&lt;': '<', '&gt;': '>' };
const decode = (value: string) => value.replace(/&(?:amp|quot|lt|gt|#x27|#39);/g, (m) => ENTITIES[m] ?? m);

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    out[m[1]!.toLowerCase()] = decode(m[2] ?? m[3] ?? '');
  }
  return out;
}

export function parseHead(html: string): HeadTags {
  const meta = new Map<string, string[]>();
  const result: HeadTags = { meta };
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = a.property ?? a.name;
    if (!key || a.content === undefined) continue;
    if (key === 'robots') result.robots = a.content;
    meta.set(key, [...(meta.get(key) ?? []), a.content]);
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (a.rel === 'canonical' && a.href) result.canonical = a.href;
  }
  return result;
}

export interface PageOptions {
  kind: 'website' | 'video' | 'series' | 'private';
  allowHttp?: boolean;
}

const REQUIRED = [
  'og:title', 'og:type', 'og:image', 'og:url', 'og:site_name', 'og:description', 'og:locale',
  'og:image:width', 'og:image:height', 'og:image:alt', 'og:image:type',
  'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt',
];
const EXPECTED_TYPE = { website: 'website', video: 'video.other', series: 'video.tv_show' } as const;
export const DESCRIPTION_MAX = 160;

export function checkPage(html: string, pageUrl: string, options: PageOptions): string[] {
  const tags = parseHead(html);
  const issues: string[] = [];
  if (options.kind === 'private') {
    if (!/noindex/i.test(tags.robots ?? '')) issues.push('private page must send noindex');
    return issues;
  }
  const first = (key: string) => tags.meta.get(key)?.[0];
  for (const key of REQUIRED) if (!first(key)) issues.push(`missing ${key}`);
  if (!tags.canonical) issues.push('missing canonical');

  const absolute = (label: string, value: string | undefined) => {
    if (!value) return;
    const ok = options.allowHttp ? /^https?:\/\/[^/\s]+/.test(value) : /^https:\/\/[^/\s]+/.test(value);
    if (!ok) issues.push(`${label} must be an absolute https url`);
  };
  absolute('og:image', first('og:image'));
  absolute('og:url', first('og:url'));
  absolute('twitter:image', first('twitter:image'));
  absolute('canonical', tags.canonical);

  if (first('og:url') && tags.canonical && first('og:url') !== tags.canonical) {
    issues.push(`canonical differs from og:url (${tags.canonical} and ${first('og:url')})`);
  }
  const expected = EXPECTED_TYPE[options.kind];
  if (first('og:type') && first('og:type') !== expected) issues.push(`og:type should be ${expected}`);
  if ([...tags.meta.keys()].some((k) => k.startsWith('og:video') || k === 'video:url')) {
    issues.push('og:video tags must not be present (media urls are signed)');
  }
  for (const [key, values] of tags.meta) {
    if (values.some((v) => /[<>]/.test(v))) issues.push(`markup in ${key}`);
  }
  const description = first('og:description');
  if (description && description.length > DESCRIPTION_MAX) {
    issues.push(`og:description is longer than ${DESCRIPTION_MAX} characters`);
  }
  if (first('twitter:card') && first('twitter:card') !== 'summary_large_image') {
    issues.push('twitter:card should be summary_large_image');
  }
  void pageUrl;
  return issues;
}

export interface ImageFetch {
  status: number;
  redirected: boolean;
  contentType: string;
  bytes: Buffer;
  /** Content-Length or the body size. */
  length: number;
  ms: number;
}

export const IMAGE_MAX_BYTES = 300_000;
export const IMAGE_MAX_MS = 2000;

export function imageSize(bytes: Buffer): { width: number; height: number; type: string } | null {
  if (bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), type: 'image/png' };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1]!;
      const size = bytes.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7), type: 'image/jpeg' };
      }
      i += 2 + size;
    }
  }
  return null;
}

export function checkImage(
  fetched: ImageFetch,
  declared: { width?: number; height?: number; type?: string },
): string[] {
  const issues: string[] = [];
  if (fetched.status !== 200) issues.push(`image status ${fetched.status}, want 200`);
  if (fetched.redirected) issues.push('image url redirects (WhatsApp and others do not follow it)');
  if (!/^image\//.test(fetched.contentType)) issues.push(`image content type is ${fetched.contentType || 'missing'}`);
  if (fetched.length > IMAGE_MAX_BYTES) issues.push(`image is over 300 KB (${Math.round(fetched.length / 1000)} KB)`);
  if (fetched.ms > IMAGE_MAX_MS) issues.push(`image is slow (${fetched.ms} ms)`);
  const real = imageSize(fetched.bytes);
  if (!real) {
    issues.push('image dimensions could not be read');
  } else {
    if (real.width < 600 || real.height < 315) issues.push(`image is smaller than 600 by 315 (${real.width} by ${real.height})`);
    if (declared.width && declared.height && (declared.width !== real.width || declared.height !== real.height)) {
      issues.push(`declared size ${declared.width} by ${declared.height} differs from real ${real.width} by ${real.height}`);
    }
    if (declared.type && fetched.contentType && declared.type !== fetched.contentType.split(';')[0]) {
      issues.push(`declared type ${declared.type} differs from content type ${fetched.contentType}`);
    }
  }
  return issues;
}

function head(over: { url: string; type: string; image?: string; canonical?: string; extra?: string }): string {
  const image = over.image ?? 'https://e.test/og/title/rivers?v=abc123';
  return (
    `<head><title>Rivers | Test TV</title>` +
    `<meta name="description" content="A film about rivers."/>` +
    `<link rel="canonical" href="${over.canonical ?? over.url}"/>` +
    `<meta property="og:title" content="Rivers"/><meta property="og:description" content="A film about rivers."/>` +
    `<meta property="og:url" content="${over.url}"/><meta property="og:site_name" content="Test TV"/>` +
    `<meta property="og:locale" content="en_NG"/><meta property="og:type" content="${over.type}"/>` +
    `<meta property="og:image" content="${image}"/><meta property="og:image:type" content="image/jpeg"/>` +
    `<meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/>` +
    `<meta property="og:image:alt" content="Rivers"/>` +
    `<meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="Rivers"/>` +
    `<meta name="twitter:description" content="A film about rivers."/>` +
    `<meta name="twitter:image" content="${image}"/><meta name="twitter:image:alt" content="Rivers"/>` +
    `${over.extra ?? ''}</head>`
  );
}

/** Fixtures for the self test (`pnpm share:check --self-test`) and the unit tests. */
export const FIXTURES = {
  goodVideo: { url: 'https://e.test/title/rivers', html: head({ url: 'https://e.test/title/rivers', type: 'video.other' }) },
  goodSeries: { url: 'https://e.test/series/rivers', html: head({ url: 'https://e.test/series/rivers', type: 'video.tv_show' }) },
  badVideo: {
    url: 'https://e.test/title/rivers',
    html: head({
      url: 'https://e.test/title/rivers',
      type: 'website',
      canonical: 'https://e.test/other',
      image: '/og/title/rivers',
      extra: '<meta property="og:video" content="https://e.test/stream.mp4"/>',
    }),
  },
} as const;
