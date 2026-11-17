// Writes placeholder PWA icons (solid brand blue with an accent play badge) using only node:zlib.
// Replace the files in apps/web/public/icons with the client's logo, or point the manifest at uploaded assets.
// Usage: node scripts/generate-pwa-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BLUE = [0x1f, 0x6f, 0xb5];
const YELLOW = [0xff, 0xc9, 0x3c];
const WHITE = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c;
  const table = Array.from({ length: 256 }, (_, n) => {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

/** `glyph` is the badge radius as a fraction of the size. Maskable icons keep it inside the 80 percent safe zone. */
function png(size, glyph) {
  const rows = [];
  const cx = size / 2;
  const cy = size / 2;
  const r = size * glyph;
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const inCircle = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      // Play triangle inside the badge.
      const tx = (x - (cx - r * 0.3)) / (r * 1.0);
      const ty = Math.abs(y - cy) / (r * 0.6);
      const inTriangle = tx >= 0 && tx <= 1 && ty <= 1 - tx;
      const colour = inTriangle ? WHITE : inCircle ? YELLOW : BLUE;
      row.set(colour, 1 + x * 3);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = resolve(import.meta.dirname, '../apps/web/public/icons');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'icon-192.png'), png(192, 0.32));
writeFileSync(resolve(dir, 'icon-512.png'), png(512, 0.32));
writeFileSync(resolve(dir, 'icon-maskable-512.png'), png(512, 0.24));
writeFileSync(resolve(dir, 'apple-touch-icon.png'), png(180, 0.32));
console.log('Wrote icons to', dir);
