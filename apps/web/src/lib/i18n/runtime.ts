import 'server-only';
import { writeAudit } from '@ad/audit';
import {
  CatalogCache,
  DbMissingStore,
  DbStore,
  MemoryMissing,
  MemoryStore,
  MissingKeySink,
  TranslationService,
  type MissingReportRow,
  type TranslationStore,
} from '@ad/i18n';
import { BASELINES, EN_NG, type CatalogShape, type DbRow, type LocaleCode } from '@ad/shared/messages';
import type { Actor } from '@ad/shared';
import { realDataEnabled } from '../../server/data/mode';
import { themeRuntime } from '../data/admin/theme-runtime';
import { currentEnabledLocales, registerCatalogOverlay, registerMissingSink } from './server';

interface Runtime {
  storeFor(actor?: Actor): TranslationStore;
  cache: CatalogCache;
  audit(entry: Parameters<typeof writeAudit>[1]): Promise<void>;
  missing(actor: Actor): { list(locale: string): Promise<MissingReportRow[]> };
  sink: MissingKeySink;
}

const KEY = Symbol.for('ad.i18n.runtime');

async function create(): Promise<Runtime> {
  if (realDataEnabled()) {
    const [{ loadWebEnv }, { createDb, createPool }] = await Promise.all([import('@ad/config'), import('@ad/db')]);
    const db = createDb(createPool(loadWebEnv().DATABASE_URL, { applicationName: 'ad-web-i18n' }));
    const cache = new CatalogCache(new DbStore(db));
    const missing = new DbMissingStore(db);
    return {
      storeFor: (actor) => new DbStore(db, actor),
      cache,
      audit: (entry) => writeAudit(db, entry),
      missing: (actor) => new DbMissingStore(db, actor),
      sink: new MissingKeySink({ flush: (rows) => missing.flush(rows), enabled: currentEnabledLocales }),
    };
  }
  const memory = new MemoryStore();
  const seen = new MemoryMissing();
  return {
    storeFor: () => memory,
    cache: new CatalogCache(memory),
    audit: async () => {},
    missing: () => seen,
    sink: new MissingKeySink({ flush: (rows) => seen.flush(rows), enabled: currentEnabledLocales }),
  };
}

export function i18nRuntime(): Promise<Runtime> {
  const holder = globalThis as unknown as Record<symbol, Promise<Runtime> | undefined>;
  return (holder[KEY] ??= create().then((rt) => {
    registerCatalogOverlay(async (locale) => {
      const approved = await rt.cache.approved(locale);
      return new Map([...approved].map(([k, v]) => [k, v as DbRow]));
    });
    registerMissingSink((locale, key, ctx) => rt.sink.record(locale, key, ctx));
    return rt;
  }));
}

/** The translation service for one staff member. Settings changes go through the audited settings service. */
export async function translationServiceFor(actor: Actor): Promise<TranslationService> {
  const [rt, theme] = await Promise.all([i18nRuntime(), themeRuntime()]);
  return new TranslationService({
    store: rt.storeFor(actor),
    english: EN_NG as unknown as CatalogShape,
    baseline: (locale) => BASELINES[locale as Exclude<LocaleCode, 'en'>] ?? {},
    audit: (event) => rt.audit(event),
    onChange: () => rt.cache.bump(),
    settings: {
      uiLanguages: async () => theme.settings.get('content.ui_languages'),
      setUiLanguages: async (next) => {
        await theme.settings.update(actor, { 'content.ui_languages': next });
      },
      minPercent: async () => theme.settings.get('i18n.publish_min_percent'),
    },
  });
}
