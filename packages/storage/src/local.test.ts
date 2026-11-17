import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { storageContract, type ContractHarness } from './contract';
import { LocalStorage, verifyLocalUrl } from './local';

const secret = new Uint8Array(32).fill(3);
const MIN = 1024;
const roots: string[] = [];

async function makeStorage(now = () => 1_700_000_000_000) {
  const root = await mkdtemp(join(tmpdir(), 'ad-storage-'));
  roots.push(root);
  return new LocalStorage({
    root,
    bucket: 'ad-originals',
    signingSecret: secret,
    baseUrl: 'http://localhost:3000/api/dev-storage',
    minPartBytes: MIN,
    now,
  });
}

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

storageContract('local', async () => {
  const storage = await makeStorage();
  const harness: ContractHarness = {
    storage,
    minPartBytes: MIN,
    uploadPart: async (url, body) => {
      const parsed = verifyLocalUrl(secret, url, 1_700_000_000_000);
      if (parsed?.kind !== 'part') throw new Error('not a part url');
      return storage.receivePart(
        parsed.key,
        parsed.uploadId,
        parsed.partNumber,
        body,
        parsed.sizeBytes,
      );
    },
  };
  return harness;
});

describe('local signed urls', () => {
  it('verifies a presigned part url and exposes what it authorises', async () => {
    const storage = await makeStorage();
    const { uploadId } = await storage.createMultipart('originals/v/u', {});
    const url = await storage.presignPart('originals/v/u', uploadId, 3, 500, 60);
    expect(verifyLocalUrl(secret, url, 1_700_000_000_000)).toEqual({
      kind: 'part',
      bucket: 'ad-originals',
      key: 'originals/v/u',
      uploadId,
      partNumber: 3,
      sizeBytes: 500,
    });
  });

  it('rejects an expired url', async () => {
    const storage = await makeStorage();
    const url = await storage.presignGet('a/b', 60);
    expect(verifyLocalUrl(secret, url, 1_700_000_000_000 + 61_000)).toBeNull();
  });

  it('rejects a url whose key was altered', async () => {
    const storage = await makeStorage();
    const url = await storage.presignGet('a/b', 60);
    expect(verifyLocalUrl(secret, url.replace('a%2Fb', 'a%2Fc'), 1_700_000_000_000)).toBeNull();
  });

  it('rejects a url signed with another secret', async () => {
    const storage = await makeStorage();
    const url = await storage.presignGet('a/b', 60);
    expect(verifyLocalUrl(new Uint8Array(32).fill(4), url, 1_700_000_000_000)).toBeNull();
  });

  it('refuses a part whose size differs from the presigned size', async () => {
    const storage = await makeStorage();
    const { uploadId } = await storage.createMultipart('originals/v/u', {});
    await expect(
      storage.receivePart('originals/v/u', uploadId, 1, new Uint8Array(10), 500),
    ).rejects.toThrow(/size/i);
  });
});
