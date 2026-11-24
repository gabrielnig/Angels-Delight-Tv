import { normalizeLocale } from '@ad/shared/messages';

/**
 * accounts.locale defaults to en for every account, so en cannot tell "chose English" from "never chose". It is
 * treated as not chosen, which leaves the cookie and Accept-Language in play. A chosen language always wins
 * through the profile, which the picker writes as well (D-329).
 */
export function accountLocaleForResolve(value: string | null | undefined): string | null {
  const code = normalizeLocale(value);
  return code && code !== 'en' ? code : null;
}

async function context() {
  const [{ accounts, withAccount }, { getServices }, { eq }] = await Promise.all([
    import('@ad/db'),
    import('../runtime/services'),
    import('drizzle-orm'),
  ]);
  return { accounts, withAccount, eq, db: getServices().db };
}

/** The raw accounts.locale, or null when unreadable. */
export async function readStoredLocale(accountId: string): Promise<string | null> {
  try {
    const { accounts, withAccount, eq, db } = await context();
    const [row] = await withAccount(db, { accountId, role: 'viewer' }, (tx) =>
      tx
        .select({ locale: accounts.locale })
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .limit(1),
    );
    return row?.locale ?? null;
  } catch {
    return null;
  }
}

/** The signed in account's language for resolveLocale: null when it is the default, unknown or unreadable. */
export async function readAccountLocale(accountId: string): Promise<string | null> {
  return accountLocaleForResolve(await readStoredLocale(accountId));
}

/** Stores the language the account chose in the picker, so mail and new devices follow it. */
export async function writeAccountLocale(accountId: string, locale: string): Promise<void> {
  const { accounts, withAccount, eq, db } = await context();
  await withAccount(db, { accountId, role: 'viewer' }, (tx) =>
    tx.update(accounts).set({ locale }).where(eq(accounts.id, accountId)),
  );
}
