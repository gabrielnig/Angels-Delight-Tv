import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { manifestKey, parseManifest, fileSha256, buildManifest } from './manifest';

describe('manifest', () => {
  it('names the manifest next to its backup', () => {
    expect(manifestKey('db/ad-20261118T023005Z.dump.enc')).toBe(
      'db/ad-20261118T023005Z.dump.enc.manifest.json',
    );
  });

  it('hashes a file in a stream', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ad-manifest-'));
    await writeFile(join(dir, 'a'), 'hello');
    expect(await fileSha256(join(dir, 'a'))).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('records the key, target, time, size and checksum and parses back', () => {
    const manifest = buildManifest({
      key: 'db/ad-20261118T023005Z.dump.enc',
      target: 'db',
      takenAt: new Date('2026-11-18T02:30:05Z'),
      bytes: 5,
      sha256: 'a'.repeat(64),
    });
    expect(manifest).toEqual({
      version: 1,
      key: 'db/ad-20261118T023005Z.dump.enc',
      target: 'db',
      takenAt: '2026-11-18T02:30:05.000Z',
      bytes: 5,
      sha256: 'a'.repeat(64),
    });
    expect(parseManifest(JSON.stringify(manifest))).toEqual(manifest);
  });

  it('refuses a manifest that is malformed, for another version or has a bad checksum', () => {
    expect(parseManifest('not json')).toBeNull();
    expect(parseManifest('{}')).toBeNull();
    const ok = {
      version: 1,
      key: 'db/ad-20261118T023005Z.dump.enc',
      target: 'db',
      takenAt: '2026-11-18T02:30:05.000Z',
      bytes: 5,
      sha256: 'a'.repeat(64),
    };
    expect(parseManifest(JSON.stringify({ ...ok, version: 2 }))).toBeNull();
    expect(parseManifest(JSON.stringify({ ...ok, sha256: 'xyz' }))).toBeNull();
    expect(parseManifest(JSON.stringify({ ...ok, bytes: -1 }))).toBeNull();
  });
});
