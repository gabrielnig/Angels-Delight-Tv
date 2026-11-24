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

  /** Paystack secret key (M48). Optional until donations are switched on. Test or live mode comes from the prefix. */
  PAYSTACK_SECRET_KEY: z
    .string()
    .regex(/^sk_(test|live)_[A-Za-z0-9]+$/, 'must be a Paystack secret key (sk_test_ or sk_live_)')
    .optional(),
  /** Overridable so tests can point at a fake Paystack server. */
  PAYSTACK_BASE_URL: z.url().default('https://api.paystack.co'),
};

/**
 * An smtp url, or the word `disabled` for a first deploy before email credentials exist. Disabled mode boots, every
 * send fails with "Email is not configured", and `pnpm dns:check` refuses it as a launch blocker. Empty stays invalid.
 */
const smtpUrl = z
  .string()
  .regex(/^(smtps?:\/\/|disabled$)/i, 'must be an smtp url, or the word disabled')
  .transform((v) => (v.toLowerCase() === 'disabled' ? 'disabled' : v));

const webShape = {
  COOKIE_PREFIX_SECURE: bool.optional(),
  TRUSTED_PROXY_MODE: z.enum(['none', 'cloudflare']).default('none'),
  EDGE_TOKEN_MODE: z.enum(['off', 'worker']).optional(),
  DEV_SKIP_MFA: bool.default(false),
  /** Viewer two step verification (M49). Off is an emergency switch: confirmed factors are then not asked for. */
  VIEWER_MFA_ENABLED: bool.default(true),
  /** Development only: every string is wrapped in the pseudo locale for layout and font QA (M46). Rejected in production. */
  DEV_PSEUDO_LOCALE: bool.default(false),
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
  /** Signs donation receipt links. Optional: a domain separated key is derived from an existing secret when unset. */
  DONATE_RECEIPT_TOKEN_SECRET: key32.optional(),

  MAX_UPLOAD_BYTES: int(5 * GIB, 1),
  UPLOAD_PART_BYTES: int(8 * MIB, 5 * MIB),

  SMTP_URL: smtpUrl,
  EMAIL_FROM: z.string().min(3),
  /** Signs bounce and complaint callbacks. The endpoint stays closed until this is set. */
  EMAIL_WEBHOOK_SECRET: z.string().min(16).optional(),
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
  /** The worker sends notification and export email from the outbox, and opens the saved staff addresses (M21-S03). */
  FIELD_KEK: key32,
  FIELD_KEK_PREVIOUS: key32.optional(),
  /** Lets the worker skip bounced addresses in the viewer digest (M44-S15). Optional so an older deploy keeps working. */
  EMAIL_HASH_PEPPER: key32.optional(),
  SMTP_URL: smtpUrl,
  EMAIL_FROM: z.string().min(3),
  SUPPORT_EMAIL: z.string().min(3).optional(),
  WHISPER_URL: z.url().optional(),
  /** Development and tests only: captions come from a scripted fake instead of the whisper service. Rejected in production. */
  WHISPER_FAKE: bool.default(false),
  /** Caption translation engine. Off by default (ruling R23). `fake` is for development and tests. */
  TRANSLATE_PROVIDER: z.enum(['none', 'google', 'fake']).default('none'),
  TRANSLATE_API_KEY: z.string().min(1).optional(),
  TRANSLATE_MAX_CHARS_PER_JOB: int(60000, 1),
  /** Characters per month the API may translate. 0 means no API use. */
  TRANSLATE_MONTHLY_CHAR_CAP: int(0, 0),
  FFMPEG_PRESET: z.enum(FFMPEG_PRESETS).default('medium'),
  FFMPEG_THREADS: int(0, 0),
  WORKER_SCRATCH_DIR: z.string().min(1).default('/tmp/ad-work'),
  /** Share of the scratch disk that must stay free before a job starts (M14-S07). Lower it on a small disk. */
  WORKER_SCRATCH_MIN_FREE_RATIO: z
    .string()
    .regex(/^0(\.\d+)?$/, 'must be a number from 0 to below 1')
    .transform(Number)
    .default(0.15),
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

const paystackRule: Rule = (env, add) => {
  if (env.PAYSTACK_SECRET_KEY?.startsWith('sk_live_') && env.NODE_ENV !== 'production') {
    add('PAYSTACK_SECRET_KEY', 'a live key is only allowed in production, use a test key here');
  }
  if (env.NODE_ENV === 'production' && !env.PAYSTACK_BASE_URL.startsWith('https://')) {
    add('PAYSTACK_BASE_URL', 'must be https in production');
  }
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
    paystackRule(common, add);
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
    if (env.DEV_PSEUDO_LOCALE) add('DEV_PSEUDO_LOCALE', 'must not be enabled in production');
    if (env.DEV_SKIP_MFA) add('DEV_SKIP_MFA', 'must not be enabled in production');
    if (env.COOKIE_PREFIX_SECURE === false) {
      add('COOKIE_PREFIX_SECURE', 'must be true in production');
    }
    if (env.TRUSTED_PROXY_MODE !== 'cloudflare') {
      add(
        'TRUSTED_PROXY_MODE',
        'must be cloudflare in production, or per IP limits share one bucket',
      );
    }
    if (!env.KEYS_DATABASE_URL_SHRED) {
      add('KEYS_DATABASE_URL_SHRED', 'required in production so deleted accounts lose their keys');
    }
    const used = new Map<string, string>();
    for (const name of [
      'FIELD_KEK',
      'EMAIL_HASH_PEPPER',
      'HLS_KEK',
      'PLAYBACK_TOKEN_SECRET',
      'MEDIA_URL_SECRET',
    ] as const) {
      const fingerprint = Buffer.from(env[name]).toString('base64');
      const other = used.get(fingerprint);
      if (other) add(name, `must differ from ${other}`);
      else used.set(fingerprint, name);
    }
  }
}).transform((env) => ({
  ...env,
  COOKIE_PREFIX_SECURE: env.COOKIE_PREFIX_SECURE ?? env.NODE_ENV === 'production',
  EDGE_TOKEN_MODE: env.EDGE_TOKEN_MODE ?? (env.NODE_ENV === 'production' ? 'worker' : 'off'),
}));

const workerSchema = withRules({ ...commonShape, ...workerShape }, (env, add) => {
  if (env.NODE_ENV === 'production' && env.WHISPER_FAKE)
    add('WHISPER_FAKE', 'must not be enabled in production');
  if (env.NODE_ENV === 'production' && env.TRANSLATE_PROVIDER === 'fake')
    add('TRANSLATE_PROVIDER', 'fake must not be used in production');
  if (env.TRANSLATE_PROVIDER === 'google' && !env.TRANSLATE_API_KEY)
    add('TRANSLATE_API_KEY', 'is required when TRANSLATE_PROVIDER is google');
});
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
