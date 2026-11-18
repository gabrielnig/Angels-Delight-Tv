import sharp from 'sharp';

/**
 * The placeholder brand kit. One source (an icon and a wordmark, both SVG) produces every raster. It is a stand
 * in until the client supplies a logo: the admin logo upload and `pnpm launch:apply` replace these files.
 */
export const BRAND_KIT_FILES = [
  'placeholder-icon.svg',
  'placeholder-wordmark.svg',
  'favicon-32.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'placeholder-og.png',
  'placeholder-email-header.png',
] as const;

export interface BrandKitOptions {
  name: string;
  /** Placeholder colours. Overridable so the kit can be regenerated for a client without code changes. */
  background?: string;
  accent?: string;
  ink?: string;
}

const DEFAULTS = { background: '#1f6fb5', accent: '#ffc93c', ink: '#ffffff' };

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A play badge on a rounded square. `pad` shrinks the art inside the canvas for maskable icons. */
export function iconSvg(o: Partial<BrandKitOptions> & { pad?: number; square?: boolean } = {}): string {
  const c = { ...DEFAULTS, ...o };
  const pad = o.pad ?? 0;
  const inner = 100 - pad * 2;
  const bg = o.square
    ? `<rect width="100" height="100" fill="${c.background}"/>`
    : `<rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${inner * 0.22}" fill="${c.background}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img"><title>placeholder icon</title>${bg}<circle cx="50" cy="50" r="${inner * 0.3}" fill="${c.accent}"/><path d="M44 38 L64 50 L44 62 Z" fill="${c.background}"/></svg>`;
}

/** The icon beside the site name. The text is the configured name, so nothing client specific is baked in. */
export function wordmarkSvg(o: BrandKitOptions): string {
  const c = { ...DEFAULTS, ...o };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120" role="img"><title>placeholder wordmark</title><g transform="scale(1.2)">${iconSvg(c).replace(/<svg[^>]*>|<\/svg>|<title>[^<]*<\/title>/g, '')}</g><text x="140" y="76" font-family="sans-serif" font-size="52" font-weight="700" fill="${c.ink}">${esc(o.name)}</text></svg>`;
}

const png = (svg: string, w: number, h?: number) =>
  sharp(Buffer.from(svg), { density: 300 })
    .resize(w, h ?? w, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

async function banner(o: BrandKitOptions, w: number, h: number): Promise<Buffer> {
  const c = { ...DEFAULTS, ...o };
  const mark = await png(wordmarkSvg(o), Math.round(w * 0.7), Math.round(h * 0.5));
  return sharp({ create: { width: w, height: h, channels: 3, background: c.background } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export async function buildBrandKit(o: BrandKitOptions): Promise<{ name: string; bytes: Buffer }[]> {
  const c = { ...DEFAULTS, ...o };
  const out: { name: string; bytes: Buffer }[] = [
    { name: 'placeholder-icon.svg', bytes: Buffer.from(iconSvg(c)) },
    { name: 'placeholder-wordmark.svg', bytes: Buffer.from(wordmarkSvg(o)) },
    { name: 'favicon-32.png', bytes: await png(iconSvg(c), 32) },
    { name: 'icon-192.png', bytes: await png(iconSvg({ ...c, square: true, pad: 8 }), 192) },
    { name: 'icon-512.png', bytes: await png(iconSvg({ ...c, square: true, pad: 8 }), 512) },
    { name: 'icon-maskable-512.png', bytes: await png(iconSvg({ ...c, square: true, pad: 20 }), 512) },
    { name: 'apple-touch-icon.png', bytes: await png(iconSvg({ ...c, square: true, pad: 8 }), 180) },
    { name: 'placeholder-og.png', bytes: await banner(o, 1200, 630) },
    { name: 'placeholder-email-header.png', bytes: await banner(o, 1200, 300) },
  ];
  return out;
}
