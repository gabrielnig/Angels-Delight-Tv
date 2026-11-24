import { sql } from 'drizzle-orm';
import {
  createViewerTestDb,
  integrationEnabled,
  seedAccount,
  type ViewerTestDb,
} from '@ad/catalog/testing';
import { recordMiss, replaceSynonymGroups } from '@ad/catalog';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setAdminRuntime } from '@/server/admin/runtime';
import type { AdminActor } from '../types';
import { realSearchAdmin } from './search-admin';

const NOW = new Date('2026-11-24T10:00:00Z');

describe.skipIf(!integrationEnabled())('real search admin (M45-S08, M45-S09)', () => {
  let t: ViewerTestDb;
  let admin: AdminActor;
  let editor: AdminActor;

  beforeAll(async () => {
    t = await createViewerTestDb();
    const a = await seedAccount(t.setup, 'admin');
    const e = await seedAccount(t.setup, 'editor');
    admin = { accountId: a.id, role: 'admin', name: 'Admin' };
    editor = { accountId: e.id, role: 'editor', name: 'Editor' };
    setAdminRuntime({ db: () => t.app, now: () => NOW });
  });
  afterAll(async () => {
    setAdminRuntime(null);
    await t?.drop();
  });

  it('loads the groups as text and the misses, most searched first', async () => {
    await replaceSynonymGroups(t.setup, [
      ['money', 'finance'],
      ['farm', 'farming'],
    ]);
    await recordMiss(t.setup, 'budgetng', NOW);
    await recordMiss(t.setup, 'budgetng', NOW);
    await recordMiss(t.setup, 'bitcoin', NOW);
    const data = await realSearchAdmin.load(admin);
    expect(data.synonyms).toBe('money, finance\nfarm, farming');
    expect(data.misses.map((m) => [m.query, m.hits])).toEqual([
      ['budgetng', 2],
      ['bitcoin', 1],
    ]);
    expect(typeof data.misses[0]!.lastSeen).toBe('string');
  });

  it('saves valid text as the whole list and returns it normalised', async () => {
    const result = await realSearchAdmin.saveSynonyms(admin, 'Money, Finance, cash\nschool, class');
    expect(result).toEqual({ ok: true, synonyms: 'money, finance, cash\nschool, class' });
    expect((await realSearchAdmin.load(admin)).synonyms).toBe('money, finance, cash\nschool, class');
  });

  it('refuses text with bad lines, names the lines and changes nothing', async () => {
    const result = await realSearchAdmin.saveSynonyms(admin, 'a, b\nsolo\nx, y, x');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.line)).toEqual([2, 3]);
    expect((await realSearchAdmin.load(admin)).synonyms).toBe('money, finance, cash\nschool, class');
  });

  it('clears every group when the text is empty', async () => {
    expect(await realSearchAdmin.saveSynonyms(admin, '  ')).toEqual({ ok: true, synonyms: '' });
    const rows = await t.setup.execute(sql`SELECT count(*)::int AS n FROM search_synonyms`);
    expect((rows as unknown as { rows: { n: number }[] }).rows[0]!.n).toBe(0);
  });

  it('writes an audit entry for a save and keeps the words out of it', async () => {
    await realSearchAdmin.saveSynonyms(admin, 'tree, plant');
    const rows = await t.setup.execute(
      sql`SELECT action, metadata::text AS extra FROM audit_log WHERE action = 'search.synonyms_replace' ORDER BY id`,
    );
    const list = (rows as unknown as { rows: { action: string; extra: string }[] }).rows;
    expect(list.length).toBeGreaterThan(0);
    expect(list.at(-1)!.extra).toContain('"groups": 1');
  });

  it('is closed to editors', async () => {
    await expect(realSearchAdmin.load(editor)).rejects.toThrow();
    expect((await realSearchAdmin.saveSynonyms(editor, 'a, b')).ok).toBe(false);
  });
});
