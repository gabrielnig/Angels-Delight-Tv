import { schema } from '@ad/db';
import { createTestDatabase, integrationEnabled, type TestDatabase } from '@ad/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readSetting } from './settings-read';

describe.skipIf(!integrationEnabled())('readSetting', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('returns the registry default when the row is missing', async () => {
    await expect(readSetting(t.db, 'audit.retention_months')).resolves.toBe(24);
  });

  it('returns the stored value once it is set', async () => {
    await t.db
      .insert(schema.settings)
      .values({ key: 'audit.retention_months', value: 12, isPublic: false });
    await expect(readSetting(t.db, 'audit.retention_months')).resolves.toBe(12);
  });

  it('falls back to the default and reports a stored value that no longer validates', async () => {
    const seen: string[] = [];
    await t.pool.query(
      "update settings set value = '5000'::jsonb where key = 'audit.retention_months'",
    );
    await expect(
      readSetting(t.db, 'audit.retention_months', { onInvalid: (key) => seen.push(key) }),
    ).resolves.toBe(24);
    expect(seen).toEqual(['audit.retention_months']);
  });
});
