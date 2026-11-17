import { describe, expect, it, vi } from 'vitest';
import { Forbidden, NotFound, ValidationFailed } from '@ad/shared';
import { DEFAULT_THEME, parseTheme } from './model';
import { THEME_ACTIONS, ThemeService, WarningsNeedConfirmation } from './service';
import { MemoryThemeStore } from './testing';

const admin = { accountId: '0198c000-0000-7000-8000-000000000001', role: 'admin' as const };
const editor = { accountId: '0198c000-0000-7000-8000-000000000002', role: 'editor' as const };

function setup(options: { now?: () => number } = {}) {
  const store = new MemoryThemeStore();
  const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() };
  const service = new ThemeService({ store, logger, now: options.now });
  return { store, audit: store.audit, service, logger };
}

const green = { colors: { primary: '#2B7A4B' } };
const lowInk = { colors: { ink: '#8A8D94' } };
const midPrimary = { colors: { primary: '#808080' } };

describe('authorisation', () => {
  it.each(['saveDraft', 'publish', 'resetToDefault', 'listHistory', 'getEditorState'] as const)(
    'refuses an editor on %s',
    async (method) => {
      const { service } = setup();
      await expect(
        (service as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)[method]!(
          editor,
          {},
        ),
      ).rejects.toBeInstanceOf(Forbidden);
    },
  );
});

describe('getPublished (viewer path)', () => {
  it('returns the default theme when nothing is published', async () => {
    const { service } = setup();
    const published = await service.getPublished();
    expect(published.source).toBe('default');
    expect(published.theme).toEqual(DEFAULT_THEME);
    expect(published.css).toContain('--color-primary: #1F6FB5;');
  });

  it('returns the published theme and caches it', async () => {
    const { service, store } = setup();
    await service.saveDraft(admin, green);
    await service.publish(admin, {});
    const first = await service.getPublished();
    expect(first.source).toBe('published');
    expect(first.theme.colors.primary).toBe('#2B7A4B');
    store.reads = 0;
    await service.getPublished();
    await service.getPublished();
    expect(store.reads).toBe(0);
  });

  it('refreshes after the ttl', async () => {
    let now = 1_000;
    const { service, store } = setup({ now: () => now });
    await service.getPublished();
    store.reads = 0;
    now += 61_000;
    await service.getPublished();
    expect(store.reads).toBe(1);
  });

  it('busts the cache on publish', async () => {
    const { service } = setup();
    await service.getPublished();
    await service.saveDraft(admin, green);
    await service.publish(admin, {});
    expect((await service.getPublished()).theme.colors.primary).toBe('#2B7A4B');
  });

  it('falls back to defaults and logs when the stored theme is invalid', async () => {
    const { service, store, logger } = setup();
    store.rows.push({
      id: 'x',
      status: 'published',
      version: 1,
      tokens: { colors: { primary: 'javascript:alert(1)' } },
      logoAssetId: null,
      faviconAssetId: null,
      createdBy: null,
      createdAt: new Date(),
      publishedAt: new Date(),
    });
    const published = await service.getPublished();
    expect(published.source).toBe('default');
    expect(published.css).toContain('--color-primary: #1F6FB5;');
    expect(logger.error).toHaveBeenCalled();
  });

  it('falls back to defaults when the database throws, and does not cache the failure for long', async () => {
    const { service, store, logger } = setup();
    store.failNextRead = true;
    expect((await service.getPublished()).source).toBe('default');
    expect(logger.error).toHaveBeenCalled();
    await service.saveDraft(admin, green);
    await service.publish(admin, {});
    expect((await service.getPublished()).source).toBe('published');
  });
});

describe('saveDraft', () => {
  it('creates the draft, then updates it in place', async () => {
    const { service, store } = setup();
    const first = await service.saveDraft(admin, green);
    const second = await service.saveDraft(admin, { ...green, fontKey: 'poppins' });
    expect(second.id).toBe(first.id);
    expect(second.version).toBe(first.version);
    expect(second.theme.fontKey).toBe('poppins');
    expect(store.rows.filter((row) => row.status === 'draft')).toHaveLength(1);
  });

  it('rejects invalid input with field errors', async () => {
    const { service } = setup();
    await expect(service.saveDraft(admin, { colors: { primary: '#1F6FZ5' } })).rejects.toThrow();
  });

  it('blocks a theme whose text fails 4.5:1 (D-007)', async () => {
    const { service, store } = setup();
    const error = await service.saveDraft(admin, lowInk).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationFailed);
    expect(store.rows).toHaveLength(0);
  });

  it('saves a draft that only has warnings', async () => {
    const { service } = setup();
    const draft = await service.saveDraft(admin, midPrimary);
    expect(draft.gate.warnings.length).toBeGreaterThan(0);
    expect(draft.gate.blocked).toBe(false);
  });

  it('audits the save', async () => {
    const { service, audit } = setup();
    const draft = await service.saveDraft(admin, green);
    expect(audit.entries.at(-1)).toMatchObject({
      action: THEME_ACTIONS.draftSaved,
      actorAccountId: admin.accountId,
      targetType: 'theme',
      targetId: draft.id,
      outcome: 'success',
    });
  });

  it('records the logo asset ids', async () => {
    const { service } = setup();
    const draft = await service.saveDraft(admin, green, {
      logoAssetId: '0198c000-0000-7000-8000-0000000000aa',
    });
    expect(draft.logoAssetId).toBe('0198c000-0000-7000-8000-0000000000aa');
    const kept = await service.saveDraft(admin, green);
    expect(kept.logoAssetId).toBe('0198c000-0000-7000-8000-0000000000aa');
    const removed = await service.saveDraft(admin, green, { logoAssetId: null });
    expect(removed.logoAssetId).toBeNull();
  });
});

describe('publish', () => {
  it('promotes the draft and archives the previous published version', async () => {
    const { service, store } = setup();
    await service.saveDraft(admin, green);
    const v1 = await service.publish(admin, {});
    await service.saveDraft(admin, { ...green, fontKey: 'nunito' });
    const v2 = await service.publish(admin, {});
    expect(v2.version).toBeGreaterThan(v1.version);
    expect(store.rows.filter((row) => row.status === 'published')).toHaveLength(1);
    expect(store.rows.find((row) => row.id === v1.id)!.status).toBe('archived');
    expect(store.rows.some((row) => row.status === 'draft')).toBe(false);
  });

  it('refuses when there is no draft', async () => {
    const { service } = setup();
    await expect(service.publish(admin, {})).rejects.toBeInstanceOf(NotFound);
  });

  it('refuses a blocked draft even if it was somehow stored', async () => {
    const { service, store } = setup();
    await service.saveDraft(admin, green);
    store.rows[0]!.tokens = parseTheme(lowInk);
    await expect(service.publish(admin, { acknowledgeWarnings: true })).rejects.toBeInstanceOf(
      ValidationFailed,
    );
  });

  it('needs confirmation for warnings and records the acknowledgement in the audit entry', async () => {
    const { service, audit, store } = setup();
    await service.saveDraft(admin, midPrimary);
    await expect(service.publish(admin, {})).rejects.toBeInstanceOf(WarningsNeedConfirmation);
    expect(store.rows[0]!.status).toBe('draft');
    await service.publish(admin, { acknowledgeWarnings: true });
    const entry = audit.entries.at(-1)!;
    expect(entry.action).toBe(THEME_ACTIONS.published);
    expect(entry.metadata.acknowledgedWarnings).toEqual(expect.arrayContaining(['on-primary']));
  });

  it('keeps the previous theme live when publishing fails', async () => {
    const { service, store } = setup();
    await service.saveDraft(admin, green);
    await service.publish(admin, {});
    await service.saveDraft(admin, { colors: { primary: '#0B3D6B' } });
    const original = store.transaction.bind(store);
    store.transaction = async (fn) =>
      original(async (tx) => {
        const result = await fn({
          ...tx,
          update: async (id, patch) => {
            if (patch.status === 'published') throw new Error('disk full');
            return tx.update(id, patch);
          },
        });
        return result;
      });
    await expect(service.publish(admin, {})).rejects.toThrow('disk full');
    store.transaction = original;
    expect((await service.getPublished()).theme.colors.primary).toBe('#2B7A4B');
    expect(store.rows.filter((row) => row.status === 'published')).toHaveLength(1);
  });
});

describe('reset to default', () => {
  it('replaces the draft with the defaults and keeps history', async () => {
    const { service, store, audit } = setup();
    await service.saveDraft(admin, green);
    await service.publish(admin, {});
    await service.saveDraft(admin, { ...green, fontKey: 'lora' });
    const reset = await service.resetToDefault(admin);
    expect(reset.theme).toEqual(DEFAULT_THEME);
    expect(store.rows.filter((row) => row.status === 'draft')).toHaveLength(1);
    expect((await service.getPublished()).theme.colors.primary).toBe('#2B7A4B');
    expect(audit.entries.at(-1)!.action).toBe(THEME_ACTIONS.reset);
  });

  it('works when there is no draft', async () => {
    const { service } = setup();
    expect((await service.resetToDefault(admin)).theme).toEqual(DEFAULT_THEME);
  });
});

describe('history and restore', () => {
  async function seed() {
    const ctx = setup();
    await ctx.service.saveDraft(admin, green);
    const a = await ctx.service.publish(admin, {});
    await ctx.service.saveDraft(admin, { colors: { primary: '#0B3D6B' }, fontKey: 'poppins' });
    const b = await ctx.service.publish(admin, {});
    await ctx.service.saveDraft(admin, { fontKey: 'nunito' });
    return { ...ctx, a, b };
  }

  it('lists newest first with current, status and by', async () => {
    const { service, b } = await seed();
    const page = await service.listHistory(admin, {});
    expect(page.total).toBe(3);
    expect(page.items.map((item) => item.version)).toEqual([3, 2, 1]);
    expect(page.items.map((item) => item.status)).toEqual(['draft', 'published', 'published']);
    expect(page.items.find((item) => item.id === b.id)!.isCurrent).toBe(true);
    expect(page.items[0]!.swatches).toHaveLength(7);
  });

  it('filters and paginates', async () => {
    const { service } = await seed();
    expect((await service.listHistory(admin, { filter: 'published' })).items).toHaveLength(2);
    expect((await service.listHistory(admin, { filter: 'draft' })).items).toHaveLength(1);
    const first = await service.listHistory(admin, { limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextBefore).toBe(2);
    const rest = await service.listHistory(admin, { limit: 2, beforeVersion: first.nextBefore! });
    expect(rest.items.map((item) => item.version)).toEqual([1]);
    expect(rest.nextBefore).toBeNull();
  });

  it('restores an old version as a new draft, replacing the current draft', async () => {
    const { service, store, a, audit } = await seed();
    const restored = await service.restoreVersion(admin, a.id);
    expect(restored.theme.colors.primary).toBe('#2B7A4B');
    expect(restored.version).toBeGreaterThan(3);
    expect(store.rows.filter((row) => row.status === 'draft')).toHaveLength(1);
    expect((await service.getPublished()).theme.fontKey).toBe('poppins');
    expect(audit.entries.at(-1)).toMatchObject({
      action: THEME_ACTIONS.restored,
      metadata: { fromVersion: a.version },
    });
  });

  it('does not restore a version that does not exist', async () => {
    const { service } = await seed();
    await expect(service.restoreVersion(admin, 'nope')).rejects.toBeInstanceOf(NotFound);
  });

  it('is empty before the first save', async () => {
    const { service } = setup();
    const page = await service.listHistory(admin, {});
    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
  });
});

describe('getEditorState', () => {
  it('uses the draft, then the published theme, then the defaults', async () => {
    const { service } = setup();
    expect((await service.getEditorState(admin)).working).toEqual(DEFAULT_THEME);
    expect((await service.getEditorState(admin)).hasDraft).toBe(false);
    await service.saveDraft(admin, green);
    await service.publish(admin, {});
    expect((await service.getEditorState(admin)).working.colors.primary).toBe('#2B7A4B');
    await service.saveDraft(admin, { colors: { primary: '#0B3D6B' } });
    const state = await service.getEditorState(admin);
    expect(state.working.colors.primary).toBe('#0B3D6B');
    expect(state.hasDraft).toBe(true);
    expect(state.publishedVersion).toBe(1);
    expect(state.gate.blocked).toBe(false);
  });
});
