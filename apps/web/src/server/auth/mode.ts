type Env = Record<string, string | undefined>;

/**
 * Real auth when the secrets exist, fixtures otherwise (local UI work without a database).
 * AUTH_FIXTURES=on|off overrides outside production. Production always runs real auth.
 */
export function realAuthEnabled(env: Env = process.env): boolean {
  if (env.NODE_ENV === 'production') return true;
  if (env.AUTH_FIXTURES === 'on') return false;
  if (env.AUTH_FIXTURES === 'off') return true;
  return Boolean(env.DATABASE_URL && env.FIELD_KEK && env.EMAIL_HASH_PEPPER);
}
