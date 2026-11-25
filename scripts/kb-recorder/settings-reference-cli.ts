import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { R04_PATH, renderR04 } from './settings-reference';

const out = renderR04();
if (process.argv.includes('--check')) {
  const same = existsSync(R04_PATH) && readFileSync(R04_PATH, 'utf8') === out;
  console.log(same ? 'R04 is current' : 'R04 is out of date, run pnpm help:settings');
  process.exit(same ? 0 : 1);
}
mkdirSync(dirname(R04_PATH), { recursive: true });
writeFileSync(R04_PATH, out);
console.log(`wrote ${R04_PATH}`);
