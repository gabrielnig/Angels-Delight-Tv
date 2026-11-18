// Writes the placeholder brand kit (SVG icon and wordmark, favicon, PWA icons, Open Graph image, email header)
// from one source. Usage: pnpm brand:generate [--name "Site name"] [--out apps/web/public/icons]
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildBrandKit } from '../packages/launch/src/brand/kit';

const { values } = parseArgs({ options: { name: { type: 'string' }, out: { type: 'string' } } });
const out = resolve(values.out ?? 'apps/web/public/icons');
const kit = await buildBrandKit({ name: values.name ?? 'Placeholder TV' });
await mkdir(out, { recursive: true });
for (const f of kit) await writeFile(join(out, f.name), f.bytes);
console.log(`Wrote ${kit.length} placeholder brand files to ${out}`);
