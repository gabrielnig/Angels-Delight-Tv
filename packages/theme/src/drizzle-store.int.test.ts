import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditLog, schema } from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  type TestDatabase,
} from '@ad/db/testing';
import { eq } from 'drizzle-orm';
import { createDrizzleThemeStore } from './drizzle-store';
import { ThemeService } from './service';

const logger = {
  error() {},
  warn() {},
  info() {},
  debug() {},
  child() {
    return logger;
  },
};

describe.skipIf(!integrationEnabled())('theme service on postgres', () => {
  let testDb: TestDatabase;
  let service: ThemeService;
  let admin: { accountId: string; role: 'admin' };

  beforeAll(async () => {
    testDb = await createTestDatabase();
    const account = makeAccount({ role: 'admin' });
    await testDb.db.insert(schema.accounts).values(account);
    admin = { accountId: account.id, role: 'admin' };
    service = new ThemeService({ store: createDrizzleThemeStore(testDb.db), logger });
  });
  afterAll(async () => {
    await testDb?.drop();
  });

  it('runs the save, publish, restore and reset flow against the real constraints', async () => {
    const draft = await service.saveDraft(admin, { colors: { primary: '#2B7A4B' } });
    expect(draft.version).toBe(1);
    const again = await service.saveDraft(admin, {
      colors: { primary: '#2B7A4B' },
      fontKey: 'poppins',
    });
    expect(again.id).toBe(draft.id);

    await service.publish(admin, {});
    expect((await service.getPublished()).theme.fontKey).toBe('poppins');

    await service.saveDraft(admin, { colors: { primary: '#0B3D6B' } });
    const v2 = await service.publish(admin, {});
    expect(v2.version).toBe(2);

    const restored = await service.restoreVersion(admin, draft.id);
    expect(restored.version).toBe(3);
    const reset = await service.resetToDefault(admin);
    expect(reset.version).toBe(4);

    const history = await service.listHistory(admin, {});
    expect(history.items.map((item) => item.version)).toEqual([4, 3, 2, 1]);
    expect(history.items.find((item) => item.version === 2)!.isCurrent).toBe(true);

    const rows = await testDb.db.select().from(schema.themeSettings);
    expect(rows.filter((row) => row.status === 'published')).toHaveLength(1);
    expect(rows.filter((row) => row.status === 'draft')).toHaveLength(1);
  });

  it('writes audit entries for each action', async () => {
    const entries = await testDb.db.select().from(auditLog).where(eq(auditLog.targetType, 'theme'));
    expect(entries.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['theme.draft_save', 'theme.publish', 'theme.restore', 'theme.reset']),
    );
    expect(entries.every((entry) => entry.outcome === 'success')).toBe(true);
  });

  it('serialises two concurrent first saves into one draft', async () => {
    await testDb.pool.query('delete from theme_settings');
    const results = await Promise.all([
      service.saveDraft(admin, { fontKey: 'nunito' }),
      service.saveDraft(admin, { fontKey: 'lora' }),
    ]);
    expect(results[0]!.id).toBe(results[1]!.id);
  });

  it('refuses a token blob over 16 KB at the database', async () => {
    await expect(
      testDb.pool.query(
        `insert into theme_settings (status, version, tokens) values ('archived', 99, $1::jsonb)`,
        [JSON.stringify({ pad: 'x'.repeat(20000) })],
      ),
    ).rejects.toThrow();
  });
});
