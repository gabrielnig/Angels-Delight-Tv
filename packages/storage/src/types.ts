import type { Readable } from 'node:stream';

export interface PutOptions {
  contentType?: string;
  cacheControl?: string;
}

export interface ObjectInfo {
  key: string;
  bytes: number;
  lastModified: Date;
}

export interface PartInfo {
  partNumber: number;
  etag: string;
  sizeBytes?: number;
}

export interface StorageAdapter {
  put(key: string, body: Uint8Array | Readable, opts: PutOptions): Promise<void>;
  get(key: string): Promise<Readable>;
  head(key: string): Promise<ObjectInfo | null>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<number>;
  list(prefix: string): Promise<ObjectInfo[]>;
  presignGet(key: string, ttlSeconds: number): Promise<string>;
  createMultipart(key: string, opts: PutOptions): Promise<{ uploadId: string }>;
  presignPart(
    key: string,
    uploadId: string,
    partNumber: number,
    sizeBytes: number,
    ttlSeconds: number,
  ): Promise<string>;
  listParts(key: string, uploadId: string): Promise<PartInfo[]>;
  completeMultipart(key: string, uploadId: string, parts: PartInfo[]): Promise<void>;
  abortMultipart(key: string, uploadId: string): Promise<void>;
}
