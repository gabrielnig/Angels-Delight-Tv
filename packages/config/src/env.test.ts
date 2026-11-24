import { describe, expect, it } from 'vitest';
import { ConfigError, loadMigrateEnv, loadWebEnv, loadWorkerEnv } from './env';

const key = (fill: number) => Buffer.alloc(32, fill).toString('base64');

const baseSecrets = {
  FIELD_KEK: key(1),
  EMAIL_HASH_PEPPER: key(2),
  HLS_KEK: key(3),
  PLAYBACK_TOKEN_SECRET: key(4),
  MEDIA_URL_SECRET: key(5),
};

const devWeb = {
  NODE_ENV: 'development',
  APP_ORIGIN: 'http://localhost:3000',
  MEDIA_ORIGIN: 'http://localhost:9000/ad-media',
  DATABASE_URL: 'postgres://ad_app:dev@localhost:5432/ad',
  KEYS_DATABASE_URL: 'postgres://ad_keys_app:dev@localhost:5432/ad_keys',
  STORAGE_DRIVER: 'local',
  LOCAL_STORAGE_ROOT: './.local-storage',
  SMTP_URL: 'smtp://localhost:1025',
  EMAIL_FROM: 'no-reply@localhost',
  ...baseSecrets,
};

const s3Vars = {
  STORAGE_DRIVER: 's3',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY_ID: 'minio',
  S3_SECRET_ACCESS_KEY: 'minio-secret',
};

const prodWeb = {
  ...devWeb,
  ...s3Vars,
  NODE_ENV: 'production',
  APP_ORIGIN: 'https://app.example.com',
  MEDIA_ORIGIN: 'https://video.example.com',
  COOKIE_PREFIX_SECURE: 'true',
  TRUSTED_PROXY_MODE: 'cloudflare',
  EDGE_TOKEN_MODE: 'worker',
  KEYS_DATABASE_URL_SHRED: 'postgres://ad_keys_shred:dev@localhost:5432/ad_keys',
};

const devWorker = {
  NODE_ENV: 'development',
  APP_ORIGIN: 'http://localhost:3000',
  MEDIA_ORIGIN: 'http://localhost:9000/ad-media',
  DATABASE_URL_WORKER: 'postgres://ad_worker:dev@localhost:5432/ad',
  KEYS_DATABASE_URL_SHRED: 'postgres://ad_keys_shred:dev@localhost:5432/ad_keys',
  STORAGE_DRIVER: 'local',
  LOCAL_STORAGE_ROOT: './.local-storage',
  HLS_KEK: key(3),
  FIELD_KEK: key(1),
  SMTP_URL: 'smtp://localhost:1025',
  EMAIL_FROM: 'no-reply@localhost',
};

function failureNames(run: () => unknown): string[] {
  try {
    run();
  } catch (error) {
    if (error instanceof ConfigError) return error.issues.map((issue) => issue.name);
    throw error;
  }
  throw new Error('expected loader to throw');
}

describe('loadWebEnv', () => {
  it('parses a complete development environment and applies defaults', () => {
    const env = loadWebEnv(devWeb);
    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.UPLOAD_PART_BYTES).toBe(8 * 1024 * 1024);
    expect(env.MAX_UPLOAD_BYTES).toBe(5 * 1024 ** 3);
    expect(env.COOKIE_PREFIX_SECURE).toBe(false);
    expect(env.TRUSTED_PROXY_MODE).toBe('none');
    expect(env.PWA_ENABLED).toBe(true);
    expect(env.APP_VERSION).toBe('dev');
    expect(env.BUCKET_ORIGINALS).toBe('ad-originals');
  });

  it('decodes secrets into 32 byte keys', () => {
    const env = loadWebEnv(devWeb);
    expect(env.FIELD_KEK).toBeInstanceOf(Uint8Array);
    expect(env.FIELD_KEK).toHaveLength(32);
  });

  it('treats a blank value like an unset variable', () => {
    expect(failureNames(() => loadWebEnv({ ...devWeb, FIELD_KEK: '' }))).toEqual(['FIELD_KEK']);
  });

  it('names every missing variable at once and never prints a value', () => {
    let message = '';
    try {
      loadWebEnv({ ...devWeb, DATABASE_URL: undefined, HLS_KEK: 'not-base64!!' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('HLS_KEK');
    expect(message).not.toContain('not-base64');
  });

  it('rejects a key that is not 32 bytes', () => {
    const short = Buffer.alloc(16, 1).toString('base64');
    expect(failureNames(() => loadWebEnv({ ...devWeb, MEDIA_URL_SECRET: short }))).toEqual([
      'MEDIA_URL_SECRET',
    ]);
  });

  it('accepts an optional previous key for rotation', () => {
    const env = loadWebEnv({ ...devWeb, HLS_KEK_PREVIOUS: key(9) });
    expect(env.HLS_KEK_PREVIOUS).toHaveLength(32);
  });

  it('requires s3 settings when the driver is s3', () => {
    const names = failureNames(() =>
      loadWebEnv({ ...devWeb, STORAGE_DRIVER: 's3', LOCAL_STORAGE_ROOT: undefined }),
    );
    expect(names).toEqual(
      expect.arrayContaining(['S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']),
    );
  });

  it('parses s3 settings, including the path style flag', () => {
    const env = loadWebEnv({ ...devWeb, ...s3Vars, S3_FORCE_PATH_STYLE: 'true' });
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    expect(env.S3_REGION).toBe('auto');
  });

  it('requires a local storage root when the driver is local', () => {
    expect(failureNames(() => loadWebEnv({ ...devWeb, LOCAL_STORAGE_ROOT: undefined }))).toEqual([
      'LOCAL_STORAGE_ROOT',
    ]);
  });

  it('rejects a non numeric size limit', () => {
    expect(failureNames(() => loadWebEnv({ ...devWeb, MAX_UPLOAD_BYTES: 'big' }))).toEqual([
      'MAX_UPLOAD_BYTES',
    ]);
  });

  it('rejects a part size below the S3 minimum of 5 MiB', () => {
    expect(failureNames(() => loadWebEnv({ ...devWeb, UPLOAD_PART_BYTES: '1048576' }))).toEqual([
      'UPLOAD_PART_BYTES',
    ]);
  });

  it('requires turnstile keys together', () => {
    expect(failureNames(() => loadWebEnv({ ...devWeb, TURNSTILE_SITE_KEY: 'site' }))).toEqual([
      'TURNSTILE_SECRET_KEY',
    ]);
  });

  it('google keys must be both or neither', () => {
    expect(failureNames(() => loadWebEnv({ ...devWeb, GOOGLE_CLIENT_ID: 'id' }))).toEqual([
      'GOOGLE_CLIENT_SECRET',
    ]);
    expect(failureNames(() => loadWebEnv({ ...devWeb, GOOGLE_CLIENT_SECRET: 'secret' }))).toEqual([
      'GOOGLE_CLIENT_ID',
    ]);
    const both = loadWebEnv({ ...devWeb, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' });
    expect(both.GOOGLE_CLIENT_ID).toBe('id');
    expect(loadWebEnv(devWeb).GOOGLE_CLIENT_ID).toBeUndefined();
  });

  describe('in production', () => {
    it('accepts a complete production environment', () => {
      expect(loadWebEnv(prodWeb).COOKIE_PREFIX_SECURE).toBe(true);
    });

    it('rejects the local storage driver', () => {
      expect(failureNames(() => loadWebEnv({ ...prodWeb, STORAGE_DRIVER: 'local' }))).toEqual([
        'STORAGE_DRIVER',
      ]);
    });

    it('rejects DEV_SKIP_MFA', () => {
      expect(failureNames(() => loadWebEnv({ ...prodWeb, DEV_SKIP_MFA: 'true' }))).toEqual([
        'DEV_SKIP_MFA',
      ]);
    });

    it('rejects running without a trusted proxy, which collapses every per IP limit into one bucket', () => {
      expect(failureNames(() => loadWebEnv({ ...prodWeb, TRUSTED_PROXY_MODE: 'none' }))).toEqual([
        'TRUSTED_PROXY_MODE',
      ]);
      const { TRUSTED_PROXY_MODE: _omitted, ...rest } = prodWeb;
      expect(failureNames(() => loadWebEnv(rest))).toEqual(['TRUSTED_PROXY_MODE']);
    });

    it('requires the shred connection so account deletion can destroy keys', () => {
      const { KEYS_DATABASE_URL_SHRED: _omitted, ...rest } = prodWeb;
      expect(failureNames(() => loadWebEnv(rest))).toEqual(['KEYS_DATABASE_URL_SHRED']);
    });

    it('rejects a secret reused for another purpose', () => {
      expect(
        failureNames(() =>
          loadWebEnv({ ...prodWeb, MEDIA_URL_SECRET: prodWeb.PLAYBACK_TOKEN_SECRET }),
        ),
      ).toEqual(['MEDIA_URL_SECRET']);
      expect(failureNames(() => loadWebEnv({ ...prodWeb, HLS_KEK: prodWeb.FIELD_KEK }))).toEqual([
        'HLS_KEK',
      ]);
    });

    it('rejects insecure cookie names', () => {
      expect(failureNames(() => loadWebEnv({ ...prodWeb, COOKIE_PREFIX_SECURE: 'false' }))).toEqual(
        ['COOKIE_PREFIX_SECURE'],
      );
    });

    it('rejects a non https app origin', () => {
      expect(
        failureNames(() => loadWebEnv({ ...prodWeb, APP_ORIGIN: 'http://app.example.com' })),
      ).toEqual(['APP_ORIGIN']);
    });
  });
});

describe('loadWebEnv auth lane variables', () => {
  it('defaults CSP to enforcing and leaves the shred connection and support address unset', () => {
    const env = loadWebEnv(devWeb);
    expect(env.CSP_REPORT_ONLY).toBe(false);
    expect(env.KEYS_DATABASE_URL_SHRED).toBeUndefined();
    expect(env.SUPPORT_EMAIL).toBeUndefined();
  });

  it('accepts the report only switch, the shred connection and a support address', () => {
    const env = loadWebEnv({
      ...devWeb,
      CSP_REPORT_ONLY: 'true',
      KEYS_DATABASE_URL_SHRED: 'postgres://ad_keys_shred:dev@localhost:5432/ad_keys',
      SUPPORT_EMAIL: 'help@example.org',
    });
    expect(env.CSP_REPORT_ONLY).toBe(true);
    expect(env.KEYS_DATABASE_URL_SHRED).toContain('ad_keys_shred');
    expect(env.SUPPORT_EMAIL).toBe('help@example.org');
  });
});

describe('loadWorkerEnv', () => {
  it('parses a development worker environment with encode defaults', () => {
    const env = loadWorkerEnv(devWorker);
    expect(env.FFMPEG_PRESET).toBe('medium');
    expect(env.WORKER_SCRATCH_DIR).toBe('/tmp/ad-work');
    expect(env.MAX_VIDEO_SECONDS).toBe(1800);
  });

  it('needs no web only secrets', () => {
    expect(() => loadWorkerEnv(devWorker)).not.toThrow();
  });

  it('needs the mail settings, because the worker sends notification email (M21-S03)', () => {
    for (const name of ['FIELD_KEK', 'SMTP_URL', 'EMAIL_FROM']) {
      expect(failureNames(() => loadWorkerEnv({ ...devWorker, [name]: undefined }))).toEqual([
        name,
      ]);
    }
    expect(loadWorkerEnv({ ...devWorker, SUPPORT_EMAIL: 'help@example.org' }).SUPPORT_EMAIL).toBe(
      'help@example.org',
    );
    expect(loadWorkerEnv(devWorker).SUPPORT_EMAIL).toBeUndefined();
    expect(loadWorkerEnv(devWorker).FIELD_KEK).toBeInstanceOf(Uint8Array);
    expect(
      failureNames(() => loadWorkerEnv({ ...devWorker, SMTP_URL: 'http://mail.example.org' })),
    ).toEqual(['SMTP_URL']);
  });

  it('requires the worker database url', () => {
    expect(
      failureNames(() => loadWorkerEnv({ ...devWorker, DATABASE_URL_WORKER: undefined })),
    ).toEqual(['DATABASE_URL_WORKER']);
  });

  it('rejects an unknown ffmpeg preset', () => {
    expect(failureNames(() => loadWorkerEnv({ ...devWorker, FFMPEG_PRESET: 'warp' }))).toEqual([
      'FFMPEG_PRESET',
    ]);
  });
});

describe('worker maintenance and fake whisper', () => {
  const prodWorker = {
    ...devWorker,
    ...s3Vars,
    NODE_ENV: 'production',
    APP_ORIGIN: 'https://app.example.com',
    MEDIA_ORIGIN: 'https://video.example.com',
  };

  it('treats the maintenance connection as optional and checks its shape', () => {
    expect(loadWorkerEnv(devWorker).DATABASE_URL_MAINTENANCE).toBeUndefined();
    const url = 'postgres://ad_maintenance:dev@localhost:5432/ad';
    expect(
      loadWorkerEnv({ ...devWorker, DATABASE_URL_MAINTENANCE: url }).DATABASE_URL_MAINTENANCE,
    ).toBe(url);
    expect(
      failureNames(() => loadWorkerEnv({ ...devWorker, DATABASE_URL_MAINTENANCE: 'nope' })),
    ).toEqual(['DATABASE_URL_MAINTENANCE']);
  });

  it('reads the scratch free space ratio, default 15 percent', () => {
    expect(loadWorkerEnv(devWorker).WORKER_SCRATCH_MIN_FREE_RATIO).toBe(0.15);
    expect(
      loadWorkerEnv({ ...devWorker, WORKER_SCRATCH_MIN_FREE_RATIO: '0.05' })
        .WORKER_SCRATCH_MIN_FREE_RATIO,
    ).toBe(0.05);
    expect(
      failureNames(() => loadWorkerEnv({ ...devWorker, WORKER_SCRATCH_MIN_FREE_RATIO: '1.5' })),
    ).toEqual(['WORKER_SCRATCH_MIN_FREE_RATIO']);
  });

  it('allows the fake transcriber outside production only', () => {
    expect(loadWorkerEnv(devWorker).WHISPER_FAKE).toBe(false);
    expect(loadWorkerEnv({ ...devWorker, WHISPER_FAKE: 'true' }).WHISPER_FAKE).toBe(true);
    expect(() => loadWorkerEnv(prodWorker)).not.toThrow();
    expect(failureNames(() => loadWorkerEnv({ ...prodWorker, WHISPER_FAKE: 'true' }))).toEqual([
      'WHISPER_FAKE',
    ]);
  });

  it('is off by default with no API use allowed', () => {
    const e = loadWorkerEnv(devWorker);
    expect(e.TRANSLATE_PROVIDER).toBe('none');
    expect(e.TRANSLATE_MONTHLY_CHAR_CAP).toBe(0);
    expect(e.TRANSLATE_MAX_CHARS_PER_JOB).toBe(60000);
  });
  it('google needs an API key', () => {
    expect(
      failureNames(() => loadWorkerEnv({ ...devWorker, TRANSLATE_PROVIDER: 'google' })),
    ).toEqual(['TRANSLATE_API_KEY']);
    expect(
      loadWorkerEnv({ ...devWorker, TRANSLATE_PROVIDER: 'google', TRANSLATE_API_KEY: 'k' })
        .TRANSLATE_PROVIDER,
    ).toBe('google');
  });
  it('fake is rejected in production', () => {
    expect(loadWorkerEnv({ ...devWorker, TRANSLATE_PROVIDER: 'fake' }).TRANSLATE_PROVIDER).toBe(
      'fake',
    );
    expect(
      failureNames(() => loadWorkerEnv({ ...prodWorker, TRANSLATE_PROVIDER: 'fake' })),
    ).toEqual(['TRANSLATE_PROVIDER']);
  });
});

describe('DEV_PSEUDO_LOCALE', () => {
  it('is off by default, allowed in development and rejected in production', () => {
    expect(loadWebEnv(devWeb).DEV_PSEUDO_LOCALE).toBe(false);
    expect(loadWebEnv({ ...devWeb, DEV_PSEUDO_LOCALE: 'true' }).DEV_PSEUDO_LOCALE).toBe(true);
    expect(failureNames(() => loadWebEnv({ ...prodWeb, DEV_PSEUDO_LOCALE: 'true' }))).toEqual([
      'DEV_PSEUDO_LOCALE',
    ]);
  });
});

describe('loadMigrateEnv', () => {
  it('needs only the owner database url', () => {
    const env = loadMigrateEnv({ DATABASE_URL_MIGRATE: 'postgres://ad_migrator:dev@localhost/ad' });
    expect(env.DATABASE_URL_MIGRATE).toContain('ad_migrator');
  });

  it('fails fast when it is missing', () => {
    expect(failureNames(() => loadMigrateEnv({}))).toEqual(['DATABASE_URL_MIGRATE']);
  });
});

describe('SMTP_URL disabled mode (no email credentials yet)', () => {
  it('boots web and worker in production with SMTP_URL=disabled', () => {
    expect(() => loadWebEnv({ ...prodWeb, SMTP_URL: 'disabled' })).not.toThrow();
    expect(loadWebEnv({ ...prodWeb, SMTP_URL: 'DISABLED' }).SMTP_URL).toBe('disabled');
    expect(() =>
      loadWorkerEnv({
        ...devWorker,
        ...s3Vars,
        NODE_ENV: 'production',
        APP_ORIGIN: 'https://app.example.com',
        MEDIA_ORIGIN: 'https://video.example.com',
        SMTP_URL: 'disabled',
      }),
    ).not.toThrow();
  });

  it('keeps the strict default: empty, missing or other words are refused', () => {
    for (const value of ['', undefined, 'off', 'none', 'disabled2']) {
      expect(failureNames(() => loadWebEnv({ ...prodWeb, SMTP_URL: value }))).toEqual(['SMTP_URL']);
      expect(failureNames(() => loadWorkerEnv({ ...devWorker, SMTP_URL: value }))).toEqual([
        'SMTP_URL',
      ]);
    }
  });
});

describe('Paystack variables (M48)', () => {
  it('accepts a missing Paystack key, donations stay off', () => {
    const env = loadWebEnv(devWeb);
    expect(env.PAYSTACK_SECRET_KEY).toBeUndefined();
    expect(env.PAYSTACK_BASE_URL).toBe('https://api.paystack.co');
  });

  it('accepts a test key in development and in production', () => {
    expect(
      loadWebEnv({ ...devWeb, PAYSTACK_SECRET_KEY: 'sk_test_abc123' }).PAYSTACK_SECRET_KEY,
    ).toBe('sk_test_abc123');
    expect(() => loadWebEnv({ ...prodWeb, PAYSTACK_SECRET_KEY: 'sk_test_abc123' })).not.toThrow();
  });

  it('refuses an sk_live key outside production', () => {
    expect(
      failureNames(() => loadWebEnv({ ...devWeb, PAYSTACK_SECRET_KEY: 'sk_live_abc123' })),
    ).toEqual(['PAYSTACK_SECRET_KEY']);
    expect(
      failureNames(() => loadWorkerEnv({ ...devWorker, PAYSTACK_SECRET_KEY: 'sk_live_abc123' })),
    ).toEqual(['PAYSTACK_SECRET_KEY']);
    expect(() => loadWebEnv({ ...prodWeb, PAYSTACK_SECRET_KEY: 'sk_live_abc123' })).not.toThrow();
  });

  it('refuses a key that is neither a test nor a live secret key, without echoing it', () => {
    let message = '';
    try {
      loadWebEnv({ ...devWeb, PAYSTACK_SECRET_KEY: 'pk_test_publickey' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('PAYSTACK_SECRET_KEY');
    expect(message).not.toContain('pk_test_publickey');
  });

  it('refuses a non https base url in production', () => {
    expect(
      failureNames(() => loadWebEnv({ ...prodWeb, PAYSTACK_BASE_URL: 'http://api.example.com' })),
    ).toEqual(['PAYSTACK_BASE_URL']);
    expect(
      loadWebEnv({ ...devWeb, PAYSTACK_BASE_URL: 'http://127.0.0.1:4010' }).PAYSTACK_BASE_URL,
    ).toBe('http://127.0.0.1:4010');
  });

  it('takes an optional receipt token secret of 32 bytes', () => {
    expect(loadWebEnv(devWeb).DONATE_RECEIPT_TOKEN_SECRET).toBeUndefined();
    expect(
      loadWebEnv({ ...devWeb, DONATE_RECEIPT_TOKEN_SECRET: key(9) }).DONATE_RECEIPT_TOKEN_SECRET,
    ).toBeInstanceOf(Uint8Array);
    expect(
      failureNames(() => loadWebEnv({ ...devWeb, DONATE_RECEIPT_TOKEN_SECRET: 'short' })),
    ).toEqual(['DONATE_RECEIPT_TOKEN_SECRET']);
  });
});

describe('viewer two step switch (M49)', () => {
  it('defaults to on', () => {
    expect(loadWebEnv(devWeb).VIEWER_MFA_ENABLED).toBe(true);
  });

  it('can be switched off as an emergency measure, also in production', () => {
    expect(loadWebEnv({ ...devWeb, VIEWER_MFA_ENABLED: 'false' }).VIEWER_MFA_ENABLED).toBe(false);
    expect(loadWebEnv({ ...prodWeb, VIEWER_MFA_ENABLED: 'false' }).VIEWER_MFA_ENABLED).toBe(false);
  });
});
