import { describe, expect, it } from 'vitest';
import { createStorage } from './factory';
import { LocalStorage } from './local';
import { S3Storage } from './s3';

describe('createStorage', () => {
  it('returns the local driver for driver local', () => {
    const storage = createStorage({
      driver: 'local',
      bucket: 'ad-media',
      root: '/tmp/ad-test',
      signingSecret: new Uint8Array(32),
    });
    expect(storage).toBeInstanceOf(LocalStorage);
  });

  it('returns the S3 driver for driver s3', () => {
    const storage = createStorage({
      driver: 's3',
      bucket: 'ad-media',
      endpoint: 'http://localhost:9000',
      region: 'auto',
      forcePathStyle: true,
      accessKeyId: 'a',
      secretAccessKey: 'b',
    });
    expect(storage).toBeInstanceOf(S3Storage);
  });
});
