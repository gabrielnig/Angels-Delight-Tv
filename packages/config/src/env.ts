import { z } from 'zod';

export type EnvSource = Record<string, string | undefined>;

export interface ConfigIssue {
  name: string;
  message: string;
}

/** Thrown when the environment is invalid. Lists variable names and reasons, never values. */
export class ConfigError extends Error {
  constructor(readonly issues: ConfigIssue[]) {
    super(
      `Invalid configuration: ${issues.map((issue) => `${issue.name} (${issue.message})`).join(', ')}`,
    );
    this.name = 'ConfigError';
  }
}

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

const bool = z.enum(['true', 'false']).transform((value) => value === 'true');

function int(fallback: number, min: number) {
  return z
    .string()
    .regex(/^\d+$/, 'must be a whole number')
    .transform(Number)
    .refine((value) => value >= min, `must be at least ${min}`)
    .default(fallback);
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const key32 = z
  .string()
  .refine((value) => BASE64.test(value) && Buffer.from(value, 'base64').length === 32, {
    message: 'must be 32 random bytes encoded as base64',
  })
  .transform((value) => new Uint8Array(Buffer.from(value, 'base64')));

const postgresUrl = z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres connection url');

const nodeEnv = z.enum(['development', 'test', 'production']).default('development');
const logLevel = z.enum(['debug', 'info', 'warn', 'error']).default('info');

const commonShape = {
  NODE_ENV: nodeEnv,
  LOG_LEVEL: logLevel,
  APP_ORIGIN: z.url(),
  MEDIA_ORIGIN: z.url(),
  SENTRY_DSN: z.url().optional(),

  HLS_KEK: key32,
  HLS_KEK_PREVIOUS: key32.optional(),
  MAX_VIDEO_SECONDS: int(1800, 1),

  STORAGE_DRIVER: z.enum(['s3', 'local']),
  LOCAL_STORAGE_ROOT: z.string().min(1).optional(),
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().min(1).default('auto'),
  S3_FORCE_PATH_STYLE: bool.default(false),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  BUCKET_ORIGINALS: z.string().min(3).default('ad-originals'),
  BUCKET_MEDIA: z.string().min(3).default('ad-media'),
};

const webShape = {
  COOKIE_PREFIX_SECURE: bool.optional(),
  TRUSTED_PROXY_MODE: z.enum(['none', 'cloudflare']).default('none'),
  EDGE_TOKEN_MODE: z.enum(['off', 'worker']).optional(),
  DEV_SKIP_MFA: bool.default(false),
  /** Kill switch for the service worker (M25-S02). Off serves a worker that clears caches and unregisters. */
  PWA_ENABLED: bool.default(true),
  /** Build id for cache names, logs and error reports. Set by CI to the git sha. */
  APP_VERSION: z.string().min(1).max(64).default('dev'),

  DATABASE_URL: postgresUrl,
  KEYS_DATABASE_URL: postgresUrl,
  /** Delete only connection to the keys database. Lets the web process finish account deletion at once. */
  KEYS_DATABASE_URL_SHRED: postgresUrl.optional(),
  CSP_REPORT_ONLY: bool.default(false),
  /** Address shown to people who need help. Falls back to the From address until site settings supply one. */
  SUPPORT_EMAIL: z.string().min(3).optional(),

  FIELD_KEK: key32,
  FIELD_KEK_PREVIOUS: key32.optional(),
  EMAIL_HASH_PEPPER: key32,
  PLAYBACK_TOKEN_SECRET: key32,
  PLAYBACK_TOKEN_SECRET_PREVIOUS: key32.optional(),
  MEDIA_URL_SECRET: key32,

  MAX_UPLOAD_BYTES: int(5 * GIB, 1),
  UPLOAD_PART_BYTES: int(8 * MIB, 5 * MIB),

  SMTP_URL: z.string().regex(/^smtps?:\/\//, 'must be an smtp url'),
  EMAIL_FROM: z.string().min(3),
  TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
};

const FFMPEG_PRESETS = [
  'ultrafast',
  'superfast',
  'veryfast',
  'faster',
  'fast',
  'medium',
  'slow',
  'slower',
  'veryslow',
] as const;

const workerShape = {
  DATABASE_URL_WORKER: postgresUrl,
  /** Connection as ad_maintenance (SELECT and DELETE on view_events and audit_log only). Without it the two prune jobs are not registered. */
  DATABASE_URL_MAINTENANCE: postgresUrl.optional(),
  KEYS_DATABASE_URL_SHRED: postgresUrl,
  WHISPER_URL: z.url().optional(),
  FFMPEG_PRESET: z.enum(FFMPEG_PRESETS).default('medium'),
  FFMPEG_THREADS: int(0, 0),
  WORKER_SCRATCH_DIR: z.string().min(1).default('/tmp/ad-work'),
};

const migrateShape = {
  DATABASE_URL_MIGRATE: postgresUrl,
  /** The keys database has its own owner credentials. Optional so a stack without it can still migrate the main database. */
  KEYS_DATABASE_URL_MIGRATE: postgresUrl.optional(),
};

/** Variables read by deploy tooling and containers other than web and worker. */
export const DEPLOY_ONLY_VARIABLES = [
  'APP_DOMAIN',
  'MEDIA_DOMAIN',
  'WHISPER_MODEL',
  'WHISPER_COMPUTE_TYPE',
  'POSTGRES_PASSWORD',
  'DB_ROLE_PASSWORD',
  'MINIO_ROOT_USER',
  'MINIO_ROOT_PASSWORD',
  'MINIO_IMAGE',
  'MC_IMAGE',
] as const;

export const ENV_VARIABLE_NAMES: string[] = [
  ...new Set([
    ...Object.keys(commonShape),
    ...Object.keys(webShape),
    ...Object.keys(workerShape),
    ...Object.keys(migrateShape),
  ]),
];

type Rule = (
  env: z.infer<z.ZodObject<typeof commonShape>>,
  add: (name: string, message: string) => void,
) => void;

const storageRule: Rule = (env, add) => {
  if (env.STORAGE_DRIVER === 's3') {
    if (!env.S3_ENDPOINT) add('S3_ENDPOINT', 'required when STORAGE_DRIVER is s3');
    if (!env.S3_ACCESS_KEY_ID) add('S3_ACCESS_KEY_ID', 'required when STORAGE_DRIVER is s3');
    if (!env.S3_SECRET_ACCESS_KEY)
      add('S3_SECRET_ACCESS_KEY', 'required when STORAGE_DRIVER is s3');
  } else if (!env.LOCAL_STORAGE_ROOT) {
    add('LOCAL_STORAGE_ROOT', 'required when STORAGE_DRIVER is local');
  }
};

const productionRule: Rule = (env, add) => {
  if (env.NODE_ENV !== 'production') return;
  if (env.STORAGE_DRIVER === 'local')
    add('STORAGE_DRIVER', 'local driver is not allowed in production');
  if (!env.APP_ORIGIN.startsWith('https://')) add('APP_ORIGIN', 'must be https in production');
  if (!env.MEDIA_ORIGIN.startsWith('https://')) add('MEDIA_ORIGIN', 'must be https in production');
};

function withRules<T extends z.ZodRawShape>(
  shape: T,
  extra?: (env: z.infer<z.ZodObject<T>>, add: (name: string, message: string) => void) => void,
) {
  return z.object(shape).superRefine((env, ctx) => {
    const add = (name: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [name], message });
    const common = env as unknown as z.infer<z.ZodObject<typeof commonShape>>;
    storageRule(common, add);
    productionRule(common, add);
    extra?.(env, add);
  });
}

const webSchema = withRules({ ...commonShape, ...webShape }, (env, add) => {
  if (Boolean(env.TURNSTILE_SITE_KEY) !== Boolean(env.TURNSTILE_SECRET_KEY)) {
    add(
      env.TURNSTILE_SITE_KEY ? 'TURNSTILE_SECRET_KEY' : 'TURNSTILE_SITE_KEY',
      'Turnstile site and secret keys must be set together',
    );
  }
  if (env.NODE_ENV === 'production') {
    if (env.DEV_SKIP_MFA) add('DEV_SKIP_MFA', 'must not be enabled in production');
    if (env.COOKIE_PREFIX_SECURE === false) {
      add('COOKIE_PREFIX_SECURE', 'must be true in production');
    }
  }
}).transform((env) => ({
  ...env,
  COOKIE_PREFIX_SECURE: env.COOKIE_PREFIX_SECURE ?? env.NODE_ENV === 'production',
  EDGE_TOKEN_MODE: env.EDGE_TOKEN_MODE ?? (env.NODE_ENV === 'production' ? 'worker' : 'off'),
}));

const workerSchema = withRules({ ...commonShape, ...workerShape });
const migrateSchema = z.object(migrateShape);

function parse<S extends z.ZodType>(schema: S, source: EnvSource): z.output<S> {
  const present = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  );
  const result = schema.safeParse(present);
  if (result.success) return result.data;
  const issues = result.error.issues.map((issue) => ({
    name: String(issue.path[0] ?? 'environment'),
    message:
      issue.code === 'invalid_type' && issue.input === undefined ? 'required' : issue.message,
  }));
  throw new ConfigError(issues);
}

export type WebEnv = z.output<typeof webSchema>;
export type WorkerEnv = z.output<typeof workerSchema>;
export type MigrateEnv = z.output<typeof migrateSchema>;

export const loadWebEnv = (source: EnvSource = process.env): WebEnv => parse(webSchema, source);
export const loadWorkerEnv = (source: EnvSource = process.env): WorkerEnv =>
  parse(workerSchema, source);
export const loadMigrateEnv = (source: EnvSource = process.env): MigrateEnv =>
  parse(migrateSchema, source);
