import { createWriteStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { pipeline as streamPipeline } from 'node:stream/promises';
import type { StorageAdapter } from '@ad/storage';

export async function downloadTo(
  storage: StorageAdapter,
  key: string,
  path: string,
): Promise<void> {
  await streamPipeline(await storage.get(key), createWriteStream(path, { mode: 0o600 }));
}

export async function readHead(path: string, bytes: number): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}
