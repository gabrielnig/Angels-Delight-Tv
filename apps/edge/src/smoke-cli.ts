/* eslint-disable no-console -- a command line tool prints its result */
import { edgeSmoke } from './smoke';

/** `pnpm edge:smoke https://video.example.org https://tv.example.org` exits 1 when any check fails. */
const [mediaOrigin, appOrigin] = process.argv.slice(2);
if (!mediaOrigin || !appOrigin) {
  console.error('usage: edge:smoke <media origin> <app origin>');
  process.exit(2);
}
const results = await edgeSmoke({ mediaOrigin, appOrigin });
for (const r of results)
  console.log(`${r.ok ? 'pass' : 'FAIL'}  ${r.name}${r.ok ? '' : `: ${r.detail}`}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
