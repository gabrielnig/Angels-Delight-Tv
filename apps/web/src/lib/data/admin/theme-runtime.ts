import 'server-only';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLogger, type Logger } from '@ad/shared';
import { realDataEnabled } from '../../../server/data/mode';
import { LocalStorage, type StorageAdapter } from '@ad/storage';
import {
  LogoUploader,
  MemoryAssetStore,
  MemorySettingsStore,
  MemoryThemeStore,
  SettingsService,
  ThemeService,
} from '@ad/theme';

export interface ThemeRuntime {
  theme: ThemeService;
  settings: SettingsService;
  logos: LogoUploader;
  storage: StorageAdapter;
  logger: Logger;
}

const KEY = Symbol.for('ad.theme.runtime');

/** ADMIN_THEME_STORE=db|memory decides. Unset follows viewer data: real data means the database store. */
function useDatabase(): boolean {
  const flag = process.env.ADMIN_THEME_STORE;
  if (flag === 'db') return true;
  if (flag === 'memory') return false;
  return realDataEnabled();
}

async function createRuntime(): Promise<ThemeRuntime> {
  const logger = createLogger({ bindings: { module: 'theme' } });
  if (useDatabase()) {
    const [
      { loadWebEnv },
      { createDb, createPool },
      { createStorage, storageConfigFromEnv },
      theme,
    ] = await Promise.all([
      import('@ad/config'),
      import('@ad/db'),
      import('@ad/storage'),
      import('@ad/theme'),
    ]);
    const env = loadWebEnv();
    const db = createDb(createPool(env.DATABASE_URL, { applicationName: 'ad-web-theme' }));
    const storage = createStorage(
      storageConfigFromEnv(env, env.BUCKET_MEDIA, env.MEDIA_URL_SECRET),
    );
    return {
      theme: new theme.ThemeService({ store: theme.createDrizzleThemeStore(db), logger }),
      settings: new theme.SettingsService({ store: theme.createDrizzleSettingsStore(db), logger }),
      logos: new theme.LogoUploader({ storage, assets: theme.createDrizzleAssetStore(db) }),
      storage,
      logger,
    };
  }
  // Memory mode (fixtures, tests): in memory stores, files in a temp folder.
  const storage = new LocalStorage({
    root: mkdtempSync(join(tmpdir(), 'ad-theme-fixture-')),
    bucket: 'media',
    signingSecret: new Uint8Array(32),
  });
  return {
    theme: new ThemeService({ store: new MemoryThemeStore(), logger }),
    settings: new SettingsService({ store: new MemorySettingsStore(), logger }),
    logos: new LogoUploader({ storage, assets: new MemoryAssetStore() }),
    storage,
    logger,
  };
}

/** One runtime per server process. */
export function themeRuntime(): Promise<ThemeRuntime> {
  const holder = globalThis as unknown as Record<symbol, Promise<ThemeRuntime> | undefined>;
  return (holder[KEY] ??= createRuntime());
}
