import sharp from 'sharp';

export const PWA_ICON_FILES = [
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
] as const;

export interface PwaIcon {
  name: (typeof PWA_ICON_FILES)[number];
  bytes: Buffer;
}

interface Spec {
  name: PwaIcon['name'];
  size: number;
  /** Share of the canvas the logo may fill. Maskable icons stay inside the 80 percent safe zone. */
  fill: number;
}

const SPECS: Spec[] = [
  { name: 'icon-192.png', size: 192, fill: 0.84 },
  { name: 'icon-512.png', size: 512, fill: 0.84 },
  { name: 'icon-maskable-512.png', size: 512, fill: 0.6 },
  { name: 'apple-touch-icon.png', size: 180, fill: 0.84 },
];

/**
 * Builds the home screen icons from the client's logo: the logo is fitted, never stretched or upscaled past its
 * source, onto a solid brand colour square. Decoding is by content, so a non image throws.
 */
export async function generatePwaIcons(
  logo: Uint8Array,
  options: { background: string },
): Promise<PwaIcon[]> {
  const source = Buffer.from(logo);
  await sharp(source, { limitInputPixels: 4096 * 4096 }).metadata();
  const icons: PwaIcon[] = [];
  for (const spec of SPECS) {
    const inner = Math.round(spec.size * spec.fill);
    const fitted = await sharp(source, { limitInputPixels: 4096 * 4096 })
      .resize({ width: inner, height: inner, fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer();
    const bytes = await sharp({
      create: { width: spec.size, height: spec.size, channels: 3, background: options.background },
    })
      .composite([{ input: fitted, gravity: 'centre' }])
      .png({ compressionLevel: 9 })
      .toBuffer();
    icons.push({ name: spec.name, bytes });
  }
  return icons;
}
