import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, integrationEnabled, type TestDatabase } from './testing';

/**
 * Every SECURITY DEFINER function pins its search path and names pg_temp last. Without `pg_temp` a session can
 * create a temporary table with the name of a real table and the definer function reads that one first.
 */
describe.skipIf(!integrationEnabled())('security definer functions pin the search path', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('lists none that lack a pinned search path with pg_temp last', async () => {
    const found = await t.pool.query<{ name: string; config: string[] | null }>(
      `SELECT p.proname AS name, p.proconfig AS config
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.prosecdef AND n.nspname = 'public'
        ORDER BY p.proname`,
    );
    expect(found.rows.length).toBeGreaterThan(10);
    const bad = found.rows
      .filter((row) => {
        const path = (row.config ?? []).find((entry) => entry.startsWith('search_path='));
        if (!path) return true;
        const parts = path
          .slice('search_path='.length)
          .split(',')
          .map((part) => part.trim());
        return parts[parts.length - 1] !== 'pg_temp';
      })
      .map((row) => row.name);
    expect(bad).toEqual([]);
  });
});
