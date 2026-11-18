import { createTestDatabase, integrationEnabled, type TestDatabase } from '@ad/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDrizzleSettingsStore } from './drizzle-store';
import { isPlaceholderBody } from './html-sanitize';
import { PAGE_SLUGS, SettingsService } from './settings-service';

const logger = {
  error() {},
  warn() {},
  info() {},
  debug() {},
  child() {
    return logger;
  },
};

const admin = { accountId: '00000000-0000-4000-8000-000000000001', role: 'admin' as const };

describe.skipIf(!integrationEnabled())('seeded site pages (M26-S01 AC3)', () => {
  let t: TestDatabase;
  let service: SettingsService;
  beforeAll(async () => {
    t = await createTestDatabase();
    service = new SettingsService({ store: createDrizzleSettingsStore(t.db), logger });
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('publishes marked placeholder text for terms, privacy, about and help on a fresh database', async () => {
    for (const slug of PAGE_SLUGS) {
      const page = await service.getPublishedPage(slug);
      expect(page, slug).not.toBeNull();
      expect(page?.version).toBe(1);
      expect(page?.html).toContain('before launch');
      expect(isPlaceholderBody(page!.html)).toBe(true);
    }
  });

  it('shows the placeholder state in the editor and keeps the launch checklist open', async () => {
    const view = await service.getPage(admin, 'terms');
    expect(view.isPlaceholder).toBe(true);
    expect(view.versions.map((v) => v.version)).toEqual([1]);
    const checklist = await service.launchChecklist(admin);
    expect(checklist.find((item) => item.id === 'terms')).toMatchObject({
      done: false,
      detail: 'Terms page has placeholder text',
    });
    expect(checklist.find((item) => item.id === 'privacy')).toMatchObject({ done: false });
  });

  it('does not overwrite a page the admin already published when the seed runs again', async () => {
    await t.pool.query(
      `UPDATE settings SET value = jsonb_set(value, '{versions,0,body}', '"<p>Real terms</p>"') WHERE key = 'pages.terms'`,
    );
    const sql = (await import('node:fs'))
      .readdirSync(new URL('../../db/migrations/main', import.meta.url))
      .filter((f) => f.includes('site_page_placeholders'))[0]!;
    const text = (await import('node:fs')).readFileSync(
      new URL(`../../db/migrations/main/${sql}`, import.meta.url),
      'utf8',
    );
    await t.pool.query(text.replace(/--> statement-breakpoint/g, ''));
    const fresh = new SettingsService({ store: createDrizzleSettingsStore(t.db), logger });
    expect((await fresh.getPublishedPage('terms'))?.html).toContain('Real terms');
  });
});
