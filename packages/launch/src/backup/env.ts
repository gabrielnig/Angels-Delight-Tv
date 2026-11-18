import { z } from 'zod';

const postgresUrl = z
  .string()
  .regex(/^postgres(ql)?:\/\/[^/]+\/[^/?]+/, 'must be a postgres url that names a database');
const days = z
  .string()
  .regex(/^\d+$/, 'must be a whole number')
  .transform(Number)
  .refine((value) => value >= 1, 'must be at least 1');

const schema = z.object({
  BACKUP_DB_URL: postgresUrl,
  BACKUP_KEYS_DB_URL: postgresUrl,
  BACKUP_PUBLIC_KEY_DB_B64: z.string().min(4),
  BACKUP_PUBLIC_KEY_KEYS_B64: z.string().min(4),
  BACKUP_S3_ENDPOINT: z.url(),
  BACKUP_S3_ACCESS_KEY_ID: z.string().min(1),
  BACKUP_S3_SECRET_ACCESS_KEY: z.string().min(1),
  BACKUP_BUCKET: z.string().min(3).default('ad-backups'),
  BACKUP_KEEP_DAILY: days.default(14),
  BACKUP_KEEP_WEEKLY: z
    .string()
    .regex(/^\d+$/, 'must be a whole number')
    .transform(Number)
    .default(8),
  BACKUP_RETAIN_LOCAL_DAYS: days.default(7),
  BACKUP_PING_URL: z.url().optional(),
  BACKUP_LOCAL_DIR: z.string().min(1).default('/backups'),
});

export interface BackupEnv {
  dbUrl: string;
  keysDbUrl: string;
  publicKeyDb: string;
  publicKeyKeys: string;
  s3Endpoint: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  bucket: string;
  /** Newest backup of each of this many days is kept, for both databases. */
  keepDaily: number;
  /** Then one a week for this many older weeks, for the main database only (SECURITY section 10). */
  keepWeekly: number;
  retainLocalDays: number;
  pingUrl?: string;
  localDir: string;
}

/** Throws a message that names the variables and the rule, never a value. */
export function loadBackupEnv(source: Record<string, string | undefined>): BackupEnv {
  const present = Object.fromEntries(
    Object.entries(source).filter(
      ([name, value]) => name.startsWith('BACKUP_') && value !== undefined && value !== '',
    ),
  );
  const result = schema.safeParse(present);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const name = String(issue.path[0]);
      const missing = issue.code === 'invalid_type' && issue.input === undefined;
      return `${name} (${missing ? 'required' : issue.message})`;
    });
    throw new Error(`Invalid backup configuration: ${issues.join(', ')}`);
  }
  const v = result.data;
  return {
    dbUrl: v.BACKUP_DB_URL,
    keysDbUrl: v.BACKUP_KEYS_DB_URL,
    publicKeyDb: v.BACKUP_PUBLIC_KEY_DB_B64,
    publicKeyKeys: v.BACKUP_PUBLIC_KEY_KEYS_B64,
    s3Endpoint: v.BACKUP_S3_ENDPOINT,
    s3AccessKeyId: v.BACKUP_S3_ACCESS_KEY_ID,
    s3SecretAccessKey: v.BACKUP_S3_SECRET_ACCESS_KEY,
    bucket: v.BACKUP_BUCKET,
    keepDaily: v.BACKUP_KEEP_DAILY,
    keepWeekly: v.BACKUP_KEEP_WEEKLY,
    retainLocalDays: v.BACKUP_RETAIN_LOCAL_DAYS,
    pingUrl: v.BACKUP_PING_URL,
    localDir: v.BACKUP_LOCAL_DIR,
  };
}

export interface RestoreStorageEnv {
  s3Endpoint: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  bucket: string;
}

/** The restore tool only needs to read the bucket, so it asks for the storage values alone. */
export function loadBackupEnvForRestore(
  source: Record<string, string | undefined>,
): RestoreStorageEnv {
  const result = z
    .object({
      BACKUP_S3_ENDPOINT: z.url(),
      BACKUP_S3_ACCESS_KEY_ID: z.string().min(1),
      BACKUP_S3_SECRET_ACCESS_KEY: z.string().min(1),
      BACKUP_BUCKET: z.string().min(3).default('ad-backups'),
    })
    .safeParse(
      Object.fromEntries(
        Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
      ),
    );
  if (!result.success) {
    const names = result.error.issues.map((issue) => String(issue.path[0]));
    throw new Error(`Invalid configuration: ${names.join(', ')} required`);
  }
  const v = result.data;
  return {
    s3Endpoint: v.BACKUP_S3_ENDPOINT,
    s3AccessKeyId: v.BACKUP_S3_ACCESS_KEY_ID,
    s3SecretAccessKey: v.BACKUP_S3_SECRET_ACCESS_KEY,
    bucket: v.BACKUP_BUCKET,
  };
}
