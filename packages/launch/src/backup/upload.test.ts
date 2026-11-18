import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorage } from '@ad/storage';
import { describe, expect, it } from 'vitest';
import { localPartWriter } from '../import/service-ports';
import { uploadFile } from './upload';

const secret = new Uint8Array(32).fill(7);

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'ad-upload-file-'));
  const storage = new LocalStorage({
    root,
    bucket: 'ad-backups',
    signingSecret: secret,
    minPartBytes: 10,
  });
  return { root, storage };
}

async function bytesOf(storage: LocalStorage, key: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of await storage.get(key)) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

describe('uploadFile', () => {
  it('puts a small file in one request and verifies its size', async () => {
    const { root, storage } = await setup();
    await writeFile(join(root, 'f'), 'hello backup');
    const bytes = await uploadFile(storage, 'db/x.enc', join(root, 'f'), {
      writePart: localPartWriter(storage, secret),
    });
    expect(bytes).toBe(12);
    expect((await bytesOf(storage, 'db/x.enc')).toString()).toBe('hello backup');
  });

  it('uses multipart above the threshold and reassembles the exact bytes', async () => {
    const { root, storage } = await setup();
    const data = Buffer.from(Array.from({ length: 95 }, (_, i) => i % 251));
    await writeFile(join(root, 'big'), data);
    const bytes = await uploadFile(storage, 'db/big.enc', join(root, 'big'), {
      writePart: localPartWriter(storage, secret),
      multipartThresholdBytes: 50,
      partBytes: 20,
    });
    expect(bytes).toBe(95);
    expect((await bytesOf(storage, 'db/big.enc')).equals(data)).toBe(true);
    expect((await readFile(join(root, 'big'))).length).toBe(95);
  });

  it('aborts the multipart upload and throws when a part fails, leaving no object', async () => {
    const { root, storage } = await setup();
    await writeFile(join(root, 'big'), Buffer.alloc(95, 1));
    let calls = 0;
    await expect(
      uploadFile(storage, 'db/bad.enc', join(root, 'big'), {
        writePart: async () => {
          if (++calls === 2) throw new Error('network down');
        },
        multipartThresholdBytes: 50,
        partBytes: 20,
      }),
    ).rejects.toThrow('network down');
    expect(await storage.head('db/bad.enc')).toBeNull();
  });
});
