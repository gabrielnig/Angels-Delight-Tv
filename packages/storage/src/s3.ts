import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  type _Object,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';
import { NotFound } from '@ad/shared';
import { assertSafeKey } from './keys';
import type { ObjectInfo, PartInfo, PutOptions, StorageAdapter } from './types';

export interface S3StorageOptions {
  bucket: string;
  endpoint: string;
  region: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  now?: () => Date;
}

const DELETE_BATCH = 1000;

function isNotFound(error: unknown): boolean {
  const name = (error as { name?: string })?.name;
  const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  return name === 'NotFound' || name === 'NoSuchKey' || status === 404;
}

function toInfo(object: _Object): ObjectInfo {
  return {
    key: object.Key ?? '',
    bytes: object.Size ?? 0,
    lastModified: object.LastModified ?? new Date(0),
  };
}

/** One driver for Cloudflare R2 and MinIO: only the endpoint and path style flag differ. */
export class S3Storage implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly now: () => Date;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.now = options.now ?? (() => new Date());
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: options.forcePathStyle,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
  }

  async put(key: string, body: Uint8Array | Readable, opts: PutOptions): Promise<void> {
    assertSafeKey(key);
    // Streams are buffered: put is for small objects (playlists, segments, images). Big files use multipart.
    const bytes = body instanceof Uint8Array ? body : await collect(body);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: opts.contentType,
        CacheControl: opts.cacheControl,
      }),
    );
  }

  async get(key: string): Promise<Readable> {
    assertSafeKey(key);
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return response.Body as Readable;
    } catch (error) {
      if (isNotFound(error)) throw new NotFound('Object not found');
      throw error;
    }
  }

  async head(key: string): Promise<ObjectInfo | null> {
    assertSafeKey(key);
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        key,
        bytes: response.ContentLength ?? 0,
        lastModified: response.LastModified ?? new Date(0),
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async list(prefix: string): Promise<ObjectInfo[]> {
    const found: ObjectInfo[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      found.push(...(page.Contents ?? []).map(toInfo));
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return found;
  }

  async deletePrefix(prefix: string): Promise<number> {
    const objects = await this.list(prefix);
    for (let start = 0; start < objects.length; start += DELETE_BATCH) {
      const batch = objects.slice(start, start + DELETE_BATCH);
      const response = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((object) => ({ Key: object.key })), Quiet: true },
        }),
      );
      if (response.Errors?.length) {
        throw new Error(`Failed to delete ${response.Errors.length} objects under ${prefix}`);
      }
    }
    return objects.length;
  }

  async presignGet(key: string, ttlSeconds: number): Promise<string> {
    assertSafeKey(key);
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: ttlSeconds,
      signingDate: this.now(),
    });
  }

  async createMultipart(key: string, opts: PutOptions): Promise<{ uploadId: string }> {
    assertSafeKey(key);
    const response = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: opts.contentType,
      }),
    );
    if (!response.UploadId) throw new Error('Storage did not return an upload id');
    return { uploadId: response.UploadId };
  }

  async presignPart(
    key: string,
    uploadId: string,
    partNumber: number,
    sizeBytes: number,
    ttlSeconds: number,
  ): Promise<string> {
    assertSafeKey(key);
    return getSignedUrl(
      this.client,
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        ContentLength: sizeBytes,
      }),
      {
        expiresIn: ttlSeconds,
        signingDate: this.now(),
        signableHeaders: new Set(['content-length']),
      },
    );
  }

  async listParts(key: string, uploadId: string): Promise<PartInfo[]> {
    assertSafeKey(key);
    const parts: PartInfo[] = [];
    let marker: string | undefined;
    do {
      const page = await this.client.send(
        new ListPartsCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumberMarker: marker,
        }),
      );
      for (const part of page.Parts ?? []) {
        parts.push({
          partNumber: part.PartNumber ?? 0,
          etag: part.ETag ?? '',
          sizeBytes: part.Size,
        });
      }
      marker = page.IsTruncated ? String(page.NextPartNumberMarker) : undefined;
    } while (marker);
    return parts;
  }

  async completeMultipart(key: string, uploadId: string, parts: PartInfo[]): Promise<void> {
    assertSafeKey(key);
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [...parts]
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
        },
      }),
    );
  }

  async abortMultipart(key: string, uploadId: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(
      new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }),
    );
  }
}

async function collect(stream: Readable): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
