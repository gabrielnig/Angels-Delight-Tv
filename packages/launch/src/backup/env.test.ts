import { describe, expect, it } from 'vitest';
import { loadBackupEnv, loadBackupEnvForRestore } from './env';

const good = {
  BACKUP_DB_URL: 'postgres://postgres:pw@postgres:5432/ad',
  BACKUP_KEYS_DB_URL: 'postgres://postgres:pw@postgres:5432/ad_keys',
  BACKUP_PUBLIC_KEY_DB_B64: 'AAAA',
  BACKUP_PUBLIC_KEY_KEYS_B64: 'BBBB',
  BACKUP_S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
  BACKUP_S3_ACCESS_KEY_ID: 'id',
  BACKUP_S3_SECRET_ACCESS_KEY: 'secret',
};

describe('loadBackupEnv', () => {
  it('reads the required values and applies the documented defaults', () => {
    const env = loadBackupEnv(good);
    expect(env).toMatchObject({
      bucket: 'ad-backups',
      retainDbDays: 35,
      retainKeysDays: 14,
      retainLocalDays: 7,
      localDir: '/backups',
      pingUrl: undefined,
    });
  });

  it('takes overrides and an empty ping url as off', () => {
    const env = loadBackupEnv({
      ...good,
      BACKUP_RETAIN_DB_DAYS: '60',
      BACKUP_PING_URL: '',
      BACKUP_BUCKET: 'other',
    });
    expect(env).toMatchObject({ retainDbDays: 60, pingUrl: undefined, bucket: 'other' });
  });

  it('names the variables that are missing or wrong and never prints values', () => {
    expect(() => loadBackupEnv({ ...good, BACKUP_S3_ACCESS_KEY_ID: '' })).toThrow(
      /BACKUP_S3_ACCESS_KEY_ID/,
    );
    expect(() => loadBackupEnv({ ...good, BACKUP_DB_URL: 'mysql://x' })).toThrow(/BACKUP_DB_URL/);
    expect(() => loadBackupEnv({ ...good, BACKUP_RETAIN_DB_DAYS: '0' })).toThrow(
      /BACKUP_RETAIN_DB_DAYS/,
    );
    try {
      loadBackupEnv({ ...good, BACKUP_DB_URL: 'mysql://user:topsecret@x' });
    } catch (error) {
      expect(String(error)).not.toContain('topsecret');
    }
  });

  it('refuses a database url that is not a superuser style url with a database name', () => {
    expect(() =>
      loadBackupEnv({ ...good, BACKUP_DB_URL: 'postgres://postgres:pw@postgres:5432' }),
    ).toThrow(/BACKUP_DB_URL/);
  });
});

describe('loadBackupEnvForRestore', () => {
  it('needs only the storage values', () => {
    expect(
      loadBackupEnvForRestore({
        BACKUP_S3_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
        BACKUP_S3_ACCESS_KEY_ID: 'id',
        BACKUP_S3_SECRET_ACCESS_KEY: 'secret',
      }),
    ).toMatchObject({ bucket: 'ad-backups' });
    expect(() => loadBackupEnvForRestore({})).toThrow(/BACKUP_S3_ENDPOINT/);
  });
});
