import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { replaceDir } from './fs-swap';

const tmp = () => mkdtempSync(join(tmpdir(), 'kb-swap-'));
const put = (dir: string, name: string, text: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), text);
};

describe('replaceDir', () => {
  it('puts the new files in place of the old ones', async () => {
    const root = tmp();
    put(join(root, 'final'), 'old.txt', 'old');
    put(join(root, 'work'), 'new.txt', 'new');
    await replaceDir(join(root, 'work'), join(root, 'final'));
    expect(existsSync(join(root, 'final', 'old.txt'))).toBe(false);
    expect(readFileSync(join(root, 'final', 'new.txt'), 'utf8')).toBe('new');
    expect(existsSync(join(root, 'work'))).toBe(false);
  });

  it('works when there was nothing before', async () => {
    const root = tmp();
    put(join(root, 'work'), 'new.txt', 'new');
    await replaceDir(join(root, 'work'), join(root, 'deep', 'final'));
    expect(readFileSync(join(root, 'deep', 'final', 'new.txt'), 'utf8')).toBe('new');
  });

  it('leaves the old files untouched when the new directory is missing', async () => {
    const root = tmp();
    put(join(root, 'final'), 'old.txt', 'old');
    await expect(replaceDir(join(root, 'nothing'), join(root, 'final'))).rejects.toThrow();
    expect(readFileSync(join(root, 'final', 'old.txt'), 'utf8')).toBe('old');
  });
});
