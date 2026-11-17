import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { NotFound, constantTimeEqual, hmacSha256 } from '@ad/shared';
import { assertSafeKey } from './keys';
import { MAX_PARTS, MIN_PART_BYTES } from './multipart';
import type { ObjectInfo, PartInfo, PutOptions, StorageAdapter } from './types';

export interface LocalStorageOptions {
  root: string;
  bucket: string;
  signingSecret: Uint8Array;
  /** Where the dev-only /api/dev-storage route is mounted. Relative by default. */
  baseUrl?: string;
  minPartBytes?: number;
  now?: () => number;
}

export type VerifiedLocalUrl =
  | { kind: 'get'; bucket: string; key: string }
  | {
      kind: 'part';
      bucket: string;
      key: string;
      uploadId: string;
      partNumber: number;
      sizeBytes: number;
    };

interface SignedFields {
  kind: 'get' | 'part';
  bucket: string;
  key: string;
  uploadId: string;
  partNumber: number;
  sizeBytes: number;
  exp: number;
}

function canonical(fields: SignedFields): string {
  return [
    fields.kind,
    fields.bucket,
    fields.key,
    fields.uploadId,
    fields.partNumber,
    fields.sizeBytes,
    fields.exp,
  ].join('\n');
}

function sign(secret: Uint8Array, fields: SignedFields): string {
  return Buffer.from(hmacSha256(secret, canonical(fields))).toString('hex');
}

/** Used by the dev-only storage route. Returns null for any url that is expired, altered or foreign. */
export function verifyLocalUrl(
  secret: Uint8Array,
  url: string,
  nowMs: number,
): VerifiedLocalUrl | null {
  const parsed = new URL(url, 'http://local.invalid');
  const kind = parsed.pathname.split('/').pop();
  const params = parsed.searchParams;
  const bucket = parsed.pathname.split('/').slice(-2, -1)[0] ?? '';
  const key = params.get('key');
  const signature = params.get('sig');
  const exp = Number(params.get('exp'));
  if ((kind !== 'get' && kind !== 'part') || !key || !signature || !Number.isFinite(exp))
    return null;

  const fields: SignedFields = {
    kind,
    bucket,
    key,
    uploadId: params.get('uploadId') ?? '',
    partNumber: Number(params.get('part') ?? 0),
    sizeBytes: Number(params.get('size') ?? 0),
    exp,
  };
  const expected = Buffer.from(sign(secret, fields));
  if (!constantTimeEqual(expected, Buffer.from(signature))) return null;
  if (nowMs > exp * 1000) return null;

  return kind === 'get'
    ? { kind, bucket, key }
    : {
        kind,
        bucket,
        key,
        uploadId: fields.uploadId,
        partNumber: fields.partNumber,
        sizeBytes: fields.sizeBytes,
      };
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT';
}

export class LocalStorage implements StorageAdapter {
  private readonly bucketDir: string;
  private readonly multipartDir: string;
  private readonly minPartBytes: number;
  private readonly now: () => number;

  constructor(private readonly options: LocalStorageOptions) {
    this.bucketDir = join(options.root, options.bucket);
    this.multipartDir = join(options.root, '.multipart', options.bucket);
    this.minPartBytes = options.minPartBytes ?? MIN_PART_BYTES;
    this.now = options.now ?? Date.now;
  }

  private pathFor(key: string): string {
    assertSafeKey(key);
    return join(this.bucketDir, key);
  }

  async put(key: string, body: Uint8Array | Readable): Promise<void> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    const temp = `${target}.${randomUUID()}.tmp`;
    if (body instanceof Readable) await pipeline(body, createWriteStream(temp));
    else await writeFile(temp, body);
    await rename(temp, target);
  }

  async get(key: string): Promise<Readable> {
    const target = this.pathFor(key);
    try {
      await stat(target);
    } catch (error) {
      if (isMissing(error)) throw new NotFound('Object not found');
      throw error;
    }
    return createReadStream(target);
  }

  async head(key: string): Promise<ObjectInfo | null> {
    try {
      const info = await stat(this.pathFor(key));
      return { key, bytes: info.size, lastModified: info.mtime };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async list(prefix: string): Promise<ObjectInfo[]> {
    const found: ObjectInfo[] = [];
    const walk = async (dir: string, relative: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch (error) {
        if (isMissing(error)) return;
        throw error;
      }
      for (const entry of entries) {
        const childKey = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(join(dir, entry.name), childKey);
        else if (childKey.startsWith(prefix) && !entry.name.endsWith('.tmp')) {
          const info = await stat(join(dir, entry.name));
          found.push({ key: childKey, bytes: info.size, lastModified: info.mtime });
        }
      }
    };
    await walk(this.bucketDir, '');
    return found.sort((a, b) => (a.key < b.key ? -1 : 1));
  }

  async deletePrefix(prefix: string): Promise<number> {
    const objects = await this.list(prefix);
    await Promise.all(objects.map((object) => this.delete(object.key)));
    return objects.length;
  }

  private sign(
    kind: 'get' | 'part',
    key: string,
    ttlSeconds: number,
    extra?: { uploadId: string; partNumber: number; sizeBytes: number },
  ): string {
    assertSafeKey(key);
    const exp = Math.floor(this.now() / 1000) + ttlSeconds;
    const fields: SignedFields = {
      kind,
      bucket: this.options.bucket,
      key,
      uploadId: extra?.uploadId ?? '',
      partNumber: extra?.partNumber ?? 0,
      sizeBytes: extra?.sizeBytes ?? 0,
      exp,
    };
    const query = new URLSearchParams({ key, exp: String(exp) });
    if (extra) {
      query.set('uploadId', extra.uploadId);
      query.set('part', String(extra.partNumber));
      query.set('size', String(extra.sizeBytes));
    }
    query.set('sig', sign(this.options.signingSecret, fields));
    const base = this.options.baseUrl ?? '/api/dev-storage';
    return `${base}/${this.options.bucket}/${kind}?${query.toString()}`;
  }

  async presignGet(key: string, ttlSeconds: number): Promise<string> {
    return this.sign('get', key, ttlSeconds);
  }

  async createMultipart(key: string, _opts?: PutOptions): Promise<{ uploadId: string }> {
    assertSafeKey(key);
    const uploadId = randomUUID();
    const dir = join(this.multipartDir, uploadId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'meta.json'), JSON.stringify({ key }));
    return { uploadId };
  }

  private async uploadDir(key: string, uploadId: string): Promise<string> {
    const dir = join(this.multipartDir, uploadId.replace(/[^A-Za-z0-9-]/g, '_'));
    try {
      const meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8')) as { key: string };
      if (meta.key === key) return dir;
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    throw new NotFound('Upload not found');
  }

  async presignPart(
    key: string,
    uploadId: string,
    partNumber: number,
    sizeBytes: number,
    ttlSeconds: number,
  ): Promise<string> {
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > MAX_PARTS) {
      throw new Error('Part number out of range');
    }
    return this.sign('part', key, ttlSeconds, { uploadId, partNumber, sizeBytes });
  }

  /** Called by the dev storage route after verifyLocalUrl. Returns the part ETag. */
  async receivePart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Uint8Array,
    expectedSize?: number,
  ): Promise<string> {
    if (expectedSize !== undefined && body.byteLength !== expectedSize) {
      throw new Error(`Part size ${body.byteLength} does not match presigned size ${expectedSize}`);
    }
    const dir = await this.uploadDir(key, uploadId);
    await writeFile(join(dir, `part-${partNumber}`), body);
    return `"${createHash('md5').update(body).digest('hex')}"`;
  }

  async listParts(key: string, uploadId: string): Promise<PartInfo[]> {
    const dir = await this.uploadDir(key, uploadId);
    const parts: PartInfo[] = [];
    for (const name of await readdir(dir)) {
      const match = /^part-(\d+)$/.exec(name);
      if (!match) continue;
      const body = await readFile(join(dir, name));
      parts.push({
        partNumber: Number(match[1]),
        etag: `"${createHash('md5').update(body).digest('hex')}"`,
        sizeBytes: body.byteLength,
      });
    }
    return parts.sort((a, b) => a.partNumber - b.partNumber);
  }

  async completeMultipart(key: string, uploadId: string, parts: PartInfo[]): Promise<void> {
    const stored = new Map(
      (await this.listParts(key, uploadId)).map((part) => [part.partNumber, part]),
    );
    const ordered = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    if (ordered.length === 0) throw new Error('No parts to complete');
    ordered.forEach((part, index) => {
      const have = stored.get(part.partNumber);
      if (!have || have.etag !== part.etag) {
        throw new Error(`Part ${part.partNumber} is missing or its ETag does not match`);
      }
      const isLast = index === ordered.length - 1;
      if (!isLast && (have.sizeBytes ?? 0) < this.minPartBytes) {
        throw new Error(`Part ${part.partNumber} is smaller than the minimum part size`);
      }
    });

    const dir = await this.uploadDir(key, uploadId);
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    const temp = `${target}.${randomUUID()}.tmp`;
    const output = createWriteStream(temp);
    for (const part of ordered) {
      await pipeline(createReadStream(join(dir, `part-${part.partNumber}`)), output, {
        end: false,
      });
    }
    await new Promise<void>((resolve, reject) =>
      output.end((error?: Error | null) => (error ? reject(error) : resolve())),
    );
    await rename(temp, target);
    await rm(dir, { recursive: true, force: true });
  }

  async abortMultipart(key: string, uploadId: string): Promise<void> {
    const dir = await this.uploadDir(key, uploadId);
    await rm(dir, { recursive: true, force: true });
  }
}
