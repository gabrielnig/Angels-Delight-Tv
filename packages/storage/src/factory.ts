import { LocalStorage } from './local';
import { S3Storage } from './s3';
import type { StorageAdapter } from './types';

export type StorageConfig =
  | {
      driver: 'local';
      bucket: string;
      root: string;
      signingSecret: Uint8Array;
      baseUrl?: string;
    }
  | {
      driver: 's3';
      bucket: string;
      endpoint: string;
      region: string;
      forcePathStyle: boolean;
      accessKeyId: string;
      secretAccessKey: string;
    };

/** Called once per bucket and process, for example originals and media. */
export function createStorage(config: StorageConfig): StorageAdapter {
  return config.driver === 'local' ? new LocalStorage(config) : new S3Storage(config);
}

/** The slice of the @ad/config env that decides storage. Structural so this package does not import config. */
export interface StorageEnv {
  STORAGE_DRIVER: 's3' | 'local';
  LOCAL_STORAGE_ROOT?: string;
  S3_ENDPOINT?: string;
  S3_REGION: string;
  S3_FORCE_PATH_STYLE: boolean;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
}

export function storageConfigFromEnv(
  env: StorageEnv,
  bucket: string,
  signingSecret: Uint8Array,
): StorageConfig {
  if (env.STORAGE_DRIVER === 'local') {
    if (!env.LOCAL_STORAGE_ROOT)
      throw new Error('LOCAL_STORAGE_ROOT is required for the local driver');
    return { driver: 'local', bucket, root: env.LOCAL_STORAGE_ROOT, signingSecret };
  }
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error('S3 endpoint and credentials are required for the s3 driver');
  }
  return {
    driver: 's3',
    bucket,
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  };
}
