import { open, readFile, stat } from 'node:fs/promises';
import type { PartInfo, StorageAdapter } from '@ad/storage';
import type { PartWriter } from '../import/service-ports';

export interface UploadFileOptions {
  /** How a part reaches the presigned url (direct PUT to R2, or the local folder in tests). */
  writePart: PartWriter;
  /** Files up to this size go in one request. Default 64 MiB. */
  multipartThresholdBytes?: number;
  /** Multipart part size. Default 16 MiB. */
  partBytes?: number;
}

/** Uploads a file and returns its size after checking the stored size matches. A failed multipart upload is aborted. */
export async function uploadFile(
  storage: StorageAdapter,
  key: string,
  path: string,
  options: UploadFileOptions,
): Promise<number> {
  const { size } = await stat(path);
  const threshold = options.multipartThresholdBytes ?? 64 * 1024 * 1024;
  if (size <= threshold) {
    await storage.put(key, await readFile(path), { contentType: 'application/octet-stream' });
  } else {
    const partBytes = options.partBytes ?? 16 * 1024 * 1024;
    const { uploadId } = await storage.createMultipart(key, {
      contentType: 'application/octet-stream',
    });
    const handle = await open(path, 'r');
    try {
      const total = Math.ceil(size / partBytes);
      for (let n = 1; n <= total; n++) {
        const start = (n - 1) * partBytes;
        const length = Math.min(partBytes, size - start);
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, start);
        const url = await storage.presignPart(key, uploadId, n, length, 3600);
        await options.writePart(url, buffer);
      }
      const parts: PartInfo[] = await storage.listParts(key, uploadId);
      await storage.completeMultipart(key, uploadId, parts);
    } catch (error) {
      await storage.abortMultipart(key, uploadId).catch(() => undefined);
      throw error;
    } finally {
      await handle.close();
    }
  }
  const head = await storage.head(key);
  if (!head || head.bytes !== size) {
    await storage.delete(key).catch(() => undefined);
    throw new Error('The stored backup size does not match what was sent');
  }
  return size;
}
