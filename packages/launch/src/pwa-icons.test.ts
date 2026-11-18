import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { PWA_ICON_FILES, generatePwaIcons } from './pwa-icons';

async function logo(width = 400, height = 200): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

describe('generatePwaIcons', () => {
  it('writes the four icon files at their sizes', async () => {
    const icons = await generatePwaIcons(await logo(), { background: '#1F6FB5' });
    expect(icons.map((icon) => icon.name)).toEqual([...PWA_ICON_FILES]);
    const sizes = await Promise.all(
      icons.map(async (icon) => {
        const meta = await sharp(icon.bytes).metadata();
        return [icon.name, meta.width, meta.height, meta.format];
      }),
    );
    expect(sizes).toEqual([
      ['icon-192.png', 192, 192, 'png'],
      ['icon-512.png', 512, 512, 'png'],
      ['icon-maskable-512.png', 512, 512, 'png'],
      ['apple-touch-icon.png', 180, 180, 'png'],
    ]);
  });

  it('keeps the maskable logo inside the 80 percent safe zone', async () => {
    const icons = await generatePwaIcons(await logo(300, 300), { background: '#0000FF' });
    const maskable = icons.find((icon) => icon.name === 'icon-maskable-512.png')!;
    const { data, info } = await sharp(maskable.bytes).raw().toBuffer({ resolveWithObject: true });
    const corner = [data[0], data[1], data[2]];
    expect(corner).toEqual([0, 0, 255]);
    const edgeMid = Math.floor(info.width * 0.05) * info.channels;
    expect([data[edgeMid]!, data[edgeMid + 1]!]).toEqual([0, 0]);
  });

  it('is deterministic so a rerun rewrites identical files', async () => {
    const input = await logo();
    const a = await generatePwaIcons(input, { background: '#1F6FB5' });
    const b = await generatePwaIcons(input, { background: '#1F6FB5' });
    expect(a.map((i) => i.bytes.toString('hex'))).toEqual(b.map((i) => i.bytes.toString('hex')));
  });

  it('rejects something that is not an image', async () => {
    await expect(
      generatePwaIcons(Buffer.from('nope'), { background: '#000000' }),
    ).rejects.toThrow();
  });
});
