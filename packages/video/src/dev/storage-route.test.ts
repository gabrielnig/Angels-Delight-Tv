import { LocalStorage } from '@ad/storage';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDevStorageHandler } from './storage-route';

const secret = new Uint8Array(32).fill(5);
const MIB = 1024 * 1024;

describe('dev storage route', () => {
  let root: string;
  let storage: LocalStorage;
  let handler: ReturnType<typeof createDevStorageHandler>;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'ad-dev-storage-'));
    storage = new LocalStorage({ root, bucket: 'ad-originals', signingSecret: secret });
    handler = createDevStorageHandler({
      nodeEnv: 'development',
      secret,
      buckets: { 'ad-originals': storage },
    });
  });
  afterAll(async () => rm(root, { recursive: true, force: true }));

  it('accepts a signed part upload and returns its ETag, then serves the assembled object', async () => {
    const { uploadId } = await storage.createMultipart('originals/v/u', {});
    const body = new Uint8Array(5 * MIB).fill(1);
    const url = await storage.presignPart('originals/v/u', uploadId, 1, body.byteLength, 60);
    const response = await handler(
      new Request(`http://localhost:3000${url}`, { method: 'PUT', body }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toMatch(/^"[0-9a-f]{32}"$/);
    expect((await storage.listParts('originals/v/u', uploadId))[0]?.sizeBytes).toBe(5 * MIB);

    await storage.completeMultipart(
      'originals/v/u',
      uploadId,
      await storage.listParts('originals/v/u', uploadId),
    );
    const get = await storage.presignGet('originals/v/u', 60);
    const read = await handler(new Request(`http://localhost:3000${get}`));
    expect(read.status).toBe(200);
    expect((await read.arrayBuffer()).byteLength).toBe(5 * MIB);
  });

  it('rejects an altered signature, a wrong body size and expired urls', async () => {
    const { uploadId } = await storage.createMultipart('originals/v/x', {});
    const good = await storage.presignPart('originals/v/x', uploadId, 1, 10, 60);
    const tampered = good.replace('size=10', 'size=11');
    expect(
      (
        await handler(
          new Request(`http://localhost:3000${tampered}`, {
            method: 'PUT',
            body: new Uint8Array(11),
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handler(
          new Request(`http://localhost:3000${good}`, { method: 'PUT', body: new Uint8Array(9) }),
        )
      ).status,
    ).toBe(400);
    const expired = await new LocalStorage({
      root,
      bucket: 'ad-originals',
      signingSecret: secret,
      now: () => Date.now() - 3600_000,
    }).presignPart('originals/v/x', uploadId, 1, 10, 60);
    expect(
      (
        await handler(
          new Request(`http://localhost:3000${expired}`, {
            method: 'PUT',
            body: new Uint8Array(10),
          }),
        )
      ).status,
    ).toBe(403);
  });

  it('answers 404 for an unknown bucket and refuses to exist in production', async () => {
    const other = await new LocalStorage({
      root,
      bucket: 'unknown',
      signingSecret: secret,
    }).presignGet('a/b', 60);
    expect((await handler(new Request(`http://localhost:3000${other}`))).status).toBe(404);
    const prod = createDevStorageHandler({
      nodeEnv: 'production',
      secret,
      buckets: { 'ad-originals': storage },
    });
    expect(
      (await prod(new Request('http://localhost:3000/api/dev-storage/ad-originals/get'))).status,
    ).toBe(404);
  });
});
