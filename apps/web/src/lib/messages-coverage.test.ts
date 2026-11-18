import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EN_NG } from '@ad/shared/messages';

const ROOTS = [resolve(__dirname, '..'), resolve(__dirname, '../../../../packages/player/src')];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

function usedKeys(): Map<string, string> {
  const used = new Map<string, string>();
  for (const file of ROOTS.flatMap(sources)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bmsg\(\s*'([a-zA-Z0-9.]+)'/g)) used.set(match[1]!, file);
  }
  return used;
}

describe('message catalog coverage (M34-S04)', () => {
  const used = usedKeys();

  it('finds the wired call sites', () => {
    expect(used.size).toBeGreaterThan(20);
  });

  it('has every key the code asks for', () => {
    const missing = [...used]
      .filter(([key]) => !(key in EN_NG))
      .map(([key, file]) => `${key} in ${file}`);
    expect(missing).toEqual([]);
  });

  it('has no key that nothing uses, so dead copy does not pile up', () => {
    const dynamic = ['player.error.'];
    const unused = Object.keys(EN_NG).filter(
      (key) => !used.has(key) && !dynamic.some((prefix) => key.startsWith(prefix)),
    );
    expect(unused).toEqual([]);
  });

  it('wires every player error title and body', () => {
    const text = readFileSync(resolve(ROOTS[1]!, 'ui/Overlays.tsx'), 'utf8');
    for (const key of Object.keys(EN_NG).filter((k) => k.startsWith('player.error.'))) {
      expect(text, key).toContain(`'${key}'`);
    }
  });
});
