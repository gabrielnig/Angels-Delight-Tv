import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditLog, schema } from '@ad/db';
import {
  createTestDatabase,
  integrationEnabled,
  makeAccount,
  type TestDatabase,
} from '@ad/db/testing';
import { eq } from 'drizzle-orm';
import { createDrizzleSettingsStore } from './drizzle-store';
import { SettingsService } from './settings-service';

const logger = {
  error() {},
  warn() {},
  info() {},
  debug() {},
  child() {
    return logger;
  },
};

describe.skipIf(!integrationEnabled())('settings service on postgres', () => {
  let testDb: TestDatabase;
  let service: SettingsService;
  let admin: { accountId: string; role: 'super_admin' };

  beforeAll(async () => {
    testDb = await createTestDatabase();
    const account = makeAccount({ role: 'super_admin' });
    await testDb.db.insert(schema.accounts).values(account);
    admin = { accountId: account.id, role: 'super_admin' };
    service = new SettingsService({ store: createDrizzleSettingsStore(testDb.db), logger });
  });
  afterAll(async () => {
    await testDb?.drop();
  });

  it('saves, reads back and audits settings', async () => {
    await service.update(admin, { 'platform.name': 'Sister V TV', 'limits.max_profiles': 3 });
    expect(await service.get('platform.name')).toBe('Sister V TV');
    // Migration 0026 seeds a placeholder row for each legal and help page, so look only at the keys written here.
    const { rows } = await testDb.pool.query(
      "select key, is_public from settings where key in ('limits.max_profiles', 'platform.name') order by key",
    );
    expect(rows).toEqual([
      { key: 'limits.max_profiles', is_public: false },
      { key: 'platform.name', is_public: true },
    ]);
    const entries = await testDb.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'settings.change'));
    expect(entries).toHaveLength(1);
  });

  it('the profile limit trigger reads the stored number', async () => {
    const { rows } = await testDb.pool.query(
      "select coalesce((select (value #>> '{}')::integer from settings where key = 'limits.max_profiles'), 5) as limit",
    );
    expect(rows[0].limit).toBe(3);
  });

  it('publishes a page version and bumps the legal version in one transaction', async () => {
    // The seeded placeholder is version 1, so the first real publish is version 2.
    await service.savePageDraft(admin, 'terms', '<p>Our terms.</p>');
    await service.publishPage(admin, 'terms');
    const { rows } = await testDb.pool.query(
      "select value from settings where key = 'legal.terms_version'",
    );
    expect(rows[0].value).toBe('v2');
    expect((await service.getPublishedPage('terms'))!.html).toBe('<p>Our terms.</p>');
  });

  it('keeps all versions under concurrent publishes', async () => {
    await service.savePageDraft(admin, 'help', '<p>One</p>');
    await service.publishPage(admin, 'help');
    await service.savePageDraft(admin, 'help', '<p>Two</p>');
    await Promise.all([
      service.publishPage(admin, 'help'),
      service.savePageDraft(admin, 'help', '<p>Three</p>'),
    ]);
    // Version 1 is the seeded placeholder (migration 0026), then the two publishes.
    const page = await service.getPage(admin, 'help');
    expect(page.versions.map((version) => version.version)).toEqual([3, 2, 1]);
  });
});
