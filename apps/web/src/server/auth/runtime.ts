import 'server-only';
import {
  KeyService,
  PasswordHasher,
  SessionService,
  StaffService,
  isPasswordBreached,
} from '@ad/auth';
import { type WebEnv, loadWebEnv } from '@ad/config';
import { createDb, createPool } from '@ad/db';
import { Mailer, OutageMonitor, RetryingTransport, transportFromSmtpUrl } from '@ad/mailer';
import { createSuppressionStore } from '../email/suppression';
import { emailBrandFrom } from './email-brand';
import { AuditWriter } from '@ad/audit';
import { themeRuntime } from '../../lib/data/admin/theme-runtime';
import { LockoutStore, RateLimiter } from '@ad/security';
import { createLogger } from '@ad/shared';

export interface AuthRuntime {
  env: WebEnv;
  staff: StaffService;
  sessions: SessionService;
  keys: KeyService;
  limiter: RateLimiter;
  lockouts: LockoutStore;
  audit: AuditWriter;
  mailer: Mailer;
  secureCookies: boolean;
  pepper: Uint8Array;
}

const slot = Symbol.for('ad.auth.runtime');
type Holder = { [slot]?: AuthRuntime };

/** Lazily built once per process. Reads and validates the environment on first use, never at import. */
export function authRuntime(): AuthRuntime {
  const holder = globalThis as Holder;
  const existing = holder[slot];
  if (existing) return existing;
  const runtime = build(loadWebEnv());
  holder[slot] = runtime;
  return runtime;
}

function build(env: WebEnv): AuthRuntime {
  const db = createDb(createPool(env.DATABASE_URL));
  const keysDb = createDb(createPool(env.KEYS_DATABASE_URL));
  const shredDb = env.KEYS_DATABASE_URL_SHRED
    ? createDb(createPool(env.KEYS_DATABASE_URL_SHRED, { max: 2 }))
    : undefined;
  const logger = createLogger({ bindings: { component: 'auth' } });
  const keys = new KeyService({
    keysDb,
    shredDb,
    kek: env.FIELD_KEK,
    kekPrevious: env.FIELD_KEK_PREVIOUS,
  });
  const sessions = new SessionService(db);
  const limiter = new RateLimiter(db, {
    onError: (e) => logger.error('rate limiter failed', { e: String(e) }),
  });
  const lockouts = new LockoutStore(db);
  const audit = new AuditWriter(db, {
    onError: (e) => logger.error('audit write failed', { e: String(e) }),
  });
  const from = env.EMAIL_FROM;
  const supportEmail = env.SUPPORT_EMAIL ?? /<([^>]+)>/.exec(from)?.[1] ?? from;
  const suppressions = createSuppressionStore(db, env.EMAIL_HASH_PEPPER);
  const outage = new OutageMonitor({
    alert: ({ since }) =>
      logger.error('email provider outage', { since: since.toISOString(), alert: 'email_outage' }),
  });
  const mailer = new Mailer(
    new RetryingTransport(transportFromSmtpUrl(env.SMTP_URL), { monitor: outage }),
    {
      isSuppressed: (address) => suppressions.isSuppressed(address),
      from,
      appName: 'Angels Delight TV',
      appOrigin: env.APP_ORIGIN,
      supportEmail,
      brand: async () => emailBrandFrom(await themeRuntime(), env.MEDIA_ORIGIN),
    },
  );
  const staff = new StaffService({
    db,
    keys,
    sessions,
    hasher: new PasswordHasher(),
    limiter,
    lockouts,
    audit,
    mailer,
    pepper: env.EMAIL_HASH_PEPPER,
    kek: env.FIELD_KEK,
    config: { supportEmail, devSkipMfa: env.DEV_SKIP_MFA },
    signUpPolicy: async () => ({
      open: await (await themeRuntime()).settings.get('features.signups_open'),
    }),
    isBreached: (password) =>
      isPasswordBreached(password, {
        onUnavailable: (e) => logger.warn('hibp unavailable', { e: String(e) }),
      }),
    logger,
  });
  return {
    env,
    staff,
    sessions,
    keys,
    limiter,
    lockouts,
    audit,
    mailer,
    secureCookies: env.COOKIE_PREFIX_SECURE,
    pepper: env.EMAIL_HASH_PEPPER,
  };
}
