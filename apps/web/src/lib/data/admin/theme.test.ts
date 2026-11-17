import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

vi.mock('server-only', () => ({}));

const { themeAdmin } = await import('./theme');
const { themeRuntime } = await import('./theme-runtime');

const admin = { accountId: 'acc_admin', role: 'admin' as const, name: 'Chiamaka Okafor' };
const editor = { accountId: 'acc_editor', role: 'editor' as const, name: 'Ngozi Eze' };

beforeEach(() => {
  // A fresh runtime for each test.
  delete (globalThis as unknown as Record<symbol, unknown>)[Symbol.for('ad.theme.runtime')];
});

describe('themeAdmin (fixture runtime)', () => {
  it('starts on the default theme with the default name', async () => {
    const result = await themeAdmin.load(admin);
    expect(result).toMatchObject({
      ok: true,
      data: { hasDraft: false, platformName: 'Angels Delight TV', publishedVersion: null },
    });
  });

  it('refuses an editor on every call', async () => {
    for (const result of [
      await themeAdmin.load(editor),
      await themeAdmin.saveDraft(editor, { theme: {} }),
      await themeAdmin.publish(editor, { theme: {} }),
      await themeAdmin.reset(editor),
      await themeAdmin.history(editor, {}),
      await themeAdmin.restore(editor, 'x'),
    ]) {
      expect(result).toEqual({ ok: false, message: 'You do not have access to the theme' });
    }
  });

  it('saves, publishes, and lists history with names', async () => {
    const saved = await themeAdmin.saveDraft(admin, {
      theme: { colors: { primary: '#2B7A4B' } },
      platformName: 'Sister V TV',
    });
    expect(saved).toMatchObject({
      ok: true,
      data: { hasDraft: true, platformName: 'Sister V TV' },
    });
    const published = await themeAdmin.publish(admin, {
      theme: { colors: { primary: '#2B7A4B' } },
    });
    expect(published).toMatchObject({ ok: true, data: { publishedVersion: 1 } });
    const history = await themeAdmin.history(admin, { filter: 'all' });
    expect(history.ok && history.data.items[0]).toMatchObject({
      version: 1,
      status: 'published',
      isCurrent: true,
      by: 'Chiamaka Okafor',
      fontLabel: 'Inter',
    });
  });

  it('returns field messages for an invalid or blocked theme and never throws', async () => {
    const bad = await themeAdmin.saveDraft(admin, { theme: { colors: { primary: 'nope' } } });
    expect(bad).toMatchObject({ ok: false, fields: { 'colors.primary': expect.any(Array) } });
    const blocked = await themeAdmin.saveDraft(admin, { theme: { colors: { ink: '#8A8D94' } } });
    expect(blocked).toMatchObject({ ok: false, fields: { theme: expect.any(Array) } });
  });

  it('reports warnings that need confirmation, then publishes once acknowledged', async () => {
    const theme = { colors: { primary: '#808080' } };
    const first = await themeAdmin.publish(admin, { theme });
    expect(first).toMatchObject({
      ok: false,
      warnings: expect.arrayContaining([expect.objectContaining({ id: 'on-primary' })]),
    });
    const second = await themeAdmin.publish(admin, { theme, acknowledgeWarnings: true });
    expect(second.ok).toBe(true);
  });

  it('rejects an invalid platform name through the settings registry', async () => {
    const result = await themeAdmin.saveDraft(admin, { theme: {}, platformName: '   ' });
    expect(result).toMatchObject({ ok: false, fields: { 'platform.name': expect.any(Array) } });
  });

  it('restores a version into the draft', async () => {
    await themeAdmin.saveDraft(admin, { theme: { fontKey: 'poppins' } });
    await themeAdmin.publish(admin, { theme: { fontKey: 'poppins' } });
    const history = await themeAdmin.history(admin, {});
    const first = history.ok ? history.data.items[0]! : null;
    await themeAdmin.saveDraft(admin, { theme: { fontKey: 'nunito' } });
    await themeAdmin.publish(admin, { theme: { fontKey: 'nunito' } });
    const restored = await themeAdmin.restore(admin, first!.id);
    expect(restored).toMatchObject({ ok: true, data: { version: 3 } });
    const editorState = await themeAdmin.load(admin);
    expect(editorState.ok && editorState.data.theme.fontKey).toBe('poppins');
  });

  it('uploads a logo and returns a preview data url', async () => {
    const png = await sharp({
      create: { width: 400, height: 100, channels: 4, background: '#1F6FB5' },
    })
      .png()
      .toBuffer();
    const result = await themeAdmin.uploadLogo(admin, png, 'Logo');
    expect(result.ok && result.data.dataUrl.startsWith('data:image/webp;base64,')).toBe(true);
    const svg = await themeAdmin.uploadLogo(
      admin,
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      null,
    );
    expect(svg).toMatchObject({ ok: false, fields: { file: [expect.stringContaining('SVG')] } });
  });

  it('hides internal errors behind a plain message', async () => {
    const runtime = await themeRuntime();
    runtime.theme.getEditorState = async () => {
      throw new Error('connection string postgres://user:secret@host leaked');
    };
    const result = await themeAdmin.load(admin);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
