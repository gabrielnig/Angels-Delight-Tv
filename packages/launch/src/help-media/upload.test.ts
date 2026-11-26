import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalStorage } from '@ad/storage';
import { planHelpUpload, uploadHelpRelease } from './upload';

async function release() {
  const root = await mkdtemp(join(tmpdir(), 'ad-help-rel-'));
  const dir = join(root, 'help', 'v1', 'VD02');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'VD02-720.mp4'), 'video720');
  await writeFile(join(dir, 'VD02-poster.webp'), 'poster');
  await writeFile(join(dir, 'VD02-captions.vtt'), 'WEBVTT');
  await writeFile(join(dir, 'notes.txt'), 'not a help file');
  return root;
}

const store = async () =>
  new LocalStorage({
    root: await mkdtemp(join(tmpdir(), 'ad-help-store-')),
    bucket: 'ad-originals',
    signingSecret: new Uint8Array(32),
  });

describe('help media upload', () => {
  it('plans keys help/<release>/<VIDEO_ID>/<file> and skips names the player never asks for', async () => {
    const root = await release();
    const plan = await planHelpUpload(root, 'v1');
    expect(plan.map((p) => p.key).sort()).toEqual([
      'help/v1/VD02/VD02-720.mp4',
      'help/v1/VD02/VD02-captions.vtt',
      'help/v1/VD02/VD02-poster.webp',
    ]);
    expect(plan.find((p) => p.key.endsWith('.mp4'))!.contentType).toBe('video/mp4');
  });

  it('refuses a release that is not a plain tag or has no folder', async () => {
    const root = await release();
    await expect(planHelpUpload(root, '../x')).rejects.toThrow(/plain/);
    await expect(planHelpUpload(root, 'v9')).rejects.toThrow(/help\/v9/);
  });

  it('uploads, then skips files that are already there with the same size', async () => {
    const root = await release();
    const storage = await store();
    const first = await uploadHelpRelease({ root, release: 'v1', storage });
    expect(first).toEqual({ uploaded: 3, skipped: 0 });
    expect((await storage.head('help/v1/VD02/VD02-720.mp4'))?.bytes).toBe(8);
    const second = await uploadHelpRelease({ root, release: 'v1', storage });
    expect(second).toEqual({ uploaded: 0, skipped: 3 });
  });

  it('writes nothing on a dry run', async () => {
    const root = await release();
    const storage = await store();
    const r = await uploadHelpRelease({ root, release: 'v1', storage, dryRun: true });
    expect(r.uploaded).toBe(3);
    expect(await storage.head('help/v1/VD02/VD02-720.mp4')).toBeNull();
  });
});
