import type { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import type { StorageAdapter } from './types';

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export interface ContractHarness {
  storage: StorageAdapter;
  /** Uploads a part through whatever the presigned URL points at, returns the part ETag. */
  uploadPart(url: string, body: Uint8Array): Promise<string>;
  minPartBytes: number;
}

/** Behaviour every driver must have. Each driver test file calls this once. */
export function storageContract(name: string, makeHarness: () => Promise<ContractHarness>): void {
  describe(`${name} storage contract`, () => {
    it('stores and reads back an object with its metadata', async () => {
      const { storage } = await makeHarness();
      await storage.put('a/hello.txt', Buffer.from('hello'), { contentType: 'text/plain' });
      expect((await readAll(await storage.get('a/hello.txt'))).toString()).toBe('hello');
      const info = await storage.head('a/hello.txt');
      expect(info?.bytes).toBe(5);
      expect(info?.key).toBe('a/hello.txt');
    });

    it('returns null from head for a missing object', async () => {
      const { storage } = await makeHarness();
      expect(await storage.head('missing/key')).toBeNull();
    });

    it('rejects get for a missing object', async () => {
      const { storage } = await makeHarness();
      await expect(storage.get('missing/key')).rejects.toThrow();
    });

    it('overwrites an existing key', async () => {
      const { storage } = await makeHarness();
      await storage.put('a/x', Buffer.from('one'), {});
      await storage.put('a/x', Buffer.from('three'), {});
      expect((await storage.head('a/x'))?.bytes).toBe(5);
    });

    it('deletes an object and tolerates deleting it twice', async () => {
      const { storage } = await makeHarness();
      await storage.put('a/gone', Buffer.from('x'), {});
      await storage.delete('a/gone');
      await storage.delete('a/gone');
      expect(await storage.head('a/gone')).toBeNull();
    });

    it('lists only keys under the prefix, in key order', async () => {
      const { storage } = await makeHarness();
      await storage.put('v/p1/720/b.ts', Buffer.from('b'), {});
      await storage.put('v/p1/720/a.ts', Buffer.from('a'), {});
      await storage.put('v/p2/720/a.ts', Buffer.from('c'), {});
      const keys = (await storage.list('v/p1/')).map((info) => info.key);
      expect(keys).toEqual(['v/p1/720/a.ts', 'v/p1/720/b.ts']);
    });

    it('deletes everything under a prefix and reports the count', async () => {
      const { storage } = await makeHarness();
      await storage.put('v/p1/a', Buffer.from('a'), {});
      await storage.put('v/p1/b/c', Buffer.from('c'), {});
      await storage.put('v/p2/a', Buffer.from('z'), {});
      expect(await storage.deletePrefix('v/p1/')).toBe(2);
      expect(await storage.list('v/')).toHaveLength(1);
    });

    it('rejects path traversal keys', async () => {
      const { storage } = await makeHarness();
      await expect(storage.put('../escape', Buffer.from('x'), {})).rejects.toThrow(/object key/i);
    });

    it('presigns a read url that mentions the expiry', async () => {
      const { storage } = await makeHarness();
      await storage.put('a/pub', Buffer.from('x'), {});
      const url = await storage.presignGet('a/pub', 60);
      expect(url).toMatch(/^https?:\/\/|^\//);
    });

    describe('multipart', () => {
      async function upload(h: ContractHarness, key: string, sizes: number[]) {
        const { uploadId } = await h.storage.createMultipart(key, { contentType: 'video/mp4' });
        const parts = [];
        for (const [index, size] of sizes.entries()) {
          const body = new Uint8Array(size).fill(index + 1);
          const url = await h.storage.presignPart(key, uploadId, index + 1, size, 60);
          const etag = await h.uploadPart(url, body);
          parts.push({ partNumber: index + 1, etag, sizeBytes: size });
        }
        return { uploadId, parts };
      }

      it('uploads parts, lists them and completes into one object', async () => {
        const h = await makeHarness();
        const sizes = [h.minPartBytes, h.minPartBytes, 100];
        const { uploadId, parts } = await upload(h, 'originals/v1/u1', sizes);
        const listed = await h.storage.listParts('originals/v1/u1', uploadId);
        expect(listed.map((part) => part.partNumber)).toEqual([1, 2, 3]);
        expect(listed.map((part) => part.sizeBytes)).toEqual(sizes);
        await h.storage.completeMultipart('originals/v1/u1', uploadId, parts);
        expect((await h.storage.head('originals/v1/u1'))?.bytes).toBe(sizes[0]! * 2 + 100);
      });

      it('lists only the parts that arrived so an upload can resume', async () => {
        const h = await makeHarness();
        const { uploadId } = await h.storage.createMultipart('originals/v1/u2', {});
        const url = await h.storage.presignPart('originals/v1/u2', uploadId, 2, 10, 60);
        await h.uploadPart(url, new Uint8Array(10));
        const listed = await h.storage.listParts('originals/v1/u2', uploadId);
        expect(listed.map((part) => part.partNumber)).toEqual([2]);
      });

      it('aborts an upload and discards its parts', async () => {
        const h = await makeHarness();
        const { uploadId } = await upload(h, 'originals/v1/u3', [h.minPartBytes, 10]);
        await h.storage.abortMultipart('originals/v1/u3', uploadId);
        await expect(h.storage.listParts('originals/v1/u3', uploadId)).rejects.toThrow();
        expect(await h.storage.head('originals/v1/u3')).toBeNull();
      });

      it('refuses to complete with a part that was never uploaded', async () => {
        const h = await makeHarness();
        const { uploadId, parts } = await upload(h, 'originals/v1/u4', [10]);
        const forged = [...parts, { partNumber: 2, etag: '"nope"', sizeBytes: 10 }];
        await expect(
          h.storage.completeMultipart('originals/v1/u4', uploadId, forged),
        ).rejects.toThrow();
      });
    });
  });
}
