import { emailHash, findAccountByEmailHash, normalizeEmail } from '@ad/auth';
import type { Database } from '@ad/db';
import type { CatalogShape } from '@ad/shared/messages';
import { normalizeLocale } from '@ad/shared/messages';

export interface MailLocalizerDeps {
  accountIdFor(address: string): Promise<string | null>;
  localeOf(accountId: string): Promise<string | null>;
  catalogOf(locale: string): Promise<CatalogShape>;
  /** content.ui_languages. Without it every known locale counts. */
  enabled?(): Promise<string[]>;
}

/** Address to the account's language and catalog for the mailer. English or unknown returns undefined. */
export function createMailLocalizer(deps: MailLocalizerDeps) {
  return async (
    address: string,
  ): Promise<{ locale: string; catalog: CatalogShape } | undefined> => {
    const id = await deps.accountIdFor(address.trim().toLowerCase());
    if (!id) return undefined;
    const locale = normalizeLocale(await deps.localeOf(id));
    if (!locale || locale === 'en') return undefined;
    if (deps.enabled && !(await deps.enabled()).includes(locale)) return undefined;
    return { locale, catalog: await deps.catalogOf(locale) };
  };
}

/** Production wiring: the lookup function used for sign in, then accounts.locale and the effective catalog. */
export function productionMailLocalizer(db: Database, pepper: Uint8Array) {
  return createMailLocalizer({
    accountIdFor: async (address) => {
      const normalized = normalizeEmail(address);
      if (!normalized) return null;
      return (await findAccountByEmailHash(db, emailHash(normalized, pepper)))?.id ?? null;
    },
    localeOf: async (accountId) =>
      (await import('../../lib/i18n/account-locale')).readStoredLocale(accountId),
    catalogOf: async (locale) =>
      (await import('../../lib/i18n/server')).loadCatalog(locale as never),
    enabled: async () =>
      (await (await import('../../lib/data/admin/theme-runtime')).themeRuntime()).settings.get(
        'content.ui_languages',
      ),
  });
}
