import { describe, expect, it } from 'vitest';
import { S3Storage } from './s3';

const storage = new S3Storage({
  bucket: 'ad-originals',
  endpoint: 'http://localhost:9000',
  region: 'auto',
  forcePathStyle: true,
  accessKeyId: 'test-access',
  secretAccessKey: 'test-secret',
  now: () => new Date('2026-01-01T00:00:00Z'),
});

describe('S3Storage presigning', () => {
  it('presigns a part upload with the part number, upload id and expiry', async () => {
    const url = new URL(
      await storage.presignPart('originals/v1/u1', 'upload-123', 4, 8_388_608, 900),
    );
    expect(url.origin).toBe('http://localhost:9000');
    expect(url.pathname).toBe('/ad-originals/originals/v1/u1');
    expect(url.searchParams.get('partNumber')).toBe('4');
    expect(url.searchParams.get('uploadId')).toBe('upload-123');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('signs the content length so a part cannot be larger than announced', async () => {
    const url = new URL(await storage.presignPart('k', 'u', 1, 5_242_880, 60));
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-length');
  });

  it('presigns a download url', async () => {
    const url = new URL(await storage.presignGet('originals/v1/u1', 120));
    expect(url.searchParams.get('X-Amz-Expires')).toBe('120');
    expect(url.pathname).toBe('/ad-originals/originals/v1/u1');
  });

  it('rejects an unsafe key before talking to S3', async () => {
    await expect(storage.presignGet('../x', 60)).rejects.toThrow(/object key/i);
  });
});
