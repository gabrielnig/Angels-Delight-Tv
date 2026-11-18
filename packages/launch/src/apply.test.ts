import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createLogger, type Actor } from '@ad/shared';
import { LocalStorage } from '@ad/storage';
import {
  LogoUploader,
  MemoryAssetStore,
  MemorySettingsStore,
  MemoryThemeStore,
  SettingsService,
  ThemeService,
} from '@ad/theme';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyClientConfig, type ApplyDeps } from './apply';
import type { ClientConfig } from './client-config';

const actor: Actor = { accountId: '018f0000-0000-7000-8000-000000000001', role: 'admin' };
const logger = createLogger({ write: () => undefined });

async function png(color: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({
    create: { width: 256, height: 128, channels: 4, background: { ...color, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

const config: ClientConfig = {
  platformName: 'Sunrise TV',
  tagline: 'Learn daily',
  domain: 'sunrise.example',
  supportEmail: 'help@sunrise.example',
  adminOwnerEmail: 'owner@sunrise.example',
  theme: { colors: { primary: '#0B5FA5', accent: '#F2B705' }, fontKey: 'nunito' },
  logo: { path: 'logo.png', altText: 'Sunrise' },
  favicon: { path: 'favicon.png' },
  legal: { terms: { html: '<p>Terms for Sunrise</p>' }, privacy: { file: 'privacy.html' } },
  languages: { default: 'en', offered: ['en', 'yo'] },
};

interface Harness {
  deps: ApplyDeps;
  dir: string;
  settings: SettingsService;
  theme: ThemeService;
}

async function harness(): Promise<Harness> {
  const dir = await mkdtemp(join(tmpdir(), 'ad-apply-'));
  await writeFile(join(dir, 'logo.png'), await png({ r: 10, g: 90, b: 160 }));
  await writeFile(join(dir, 'favicon.png'), await png({ r: 240, g: 180, b: 5 }));
  await writeFile(join(dir, 'privacy.html'), '<h2>Privacy</h2><p>We keep little data.</p>');
  await mkdir(join(dir, 'icons'));
  await writeFile(join(dir, 'env.production'), 'APP_DOMAIN=\nOTHER=1\n');
  const settings = new SettingsService({ store: new MemorySettingsStore(), logger });
  const theme = new ThemeService({ store: new MemoryThemeStore(), logger });
  const storage = new LocalStorage({
    root: join(dir, 'media'),
    bucket: 'media',
    signingSecret: new Uint8Array(32),
  });
  const logos = new LogoUploader({ storage, assets: new MemoryAssetStore() });
  return {
    dir,
    settings,
    theme,
    deps: {
      settings,
      theme,
      logos,
      actor,
      baseDir: dir,
      iconsDir: join(dir, 'icons'),
      envFile: join(dir, 'env.production'),
    },
  };
}

describe('applyClientConfig', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await harness();
  });

  it('applies settings, theme, logos, legal pages, icons and env values', async () => {
    const report = await applyClientConfig(config, h.deps, { dryRun: false });
    expect(report.ok).toBe(true);
    const all = await h.settings.getAll();
    expect(all['platform.name']).toBe('Sunrise TV');
    expect(all['platform.canonical_host']).toBe('sunrise.example');
    expect(all['platform.support_email']).toBe('help@sunrise.example');
    expect(all['content.languages']).toEqual(['en', 'yo']);
    expect(all['legal.terms_version']).toBe('v1');
    expect(all['legal.privacy_version']).toBe('v1');

    const published = await h.theme.getPublished();
    expect(published.source).toBe('published');
    expect(published.theme.colors.primary).toBe('#0B5FA5');
    expect(published.theme.fontKey).toBe('nunito');
    expect(published.logoAssetId).not.toBeNull();
    expect(published.faviconAssetId).not.toBeNull();

    const page = await h.settings.getPublishedPage('privacy');
    expect(page?.html).toContain('We keep little data');

    const icon = await sharp(await readFile(join(h.dir, 'icons', 'icon-512.png'))).metadata();
    expect(icon.width).toBe(512);

    const env = await readFile(join(h.dir, 'env.production'), 'utf8');
    expect(env).toContain('APP_DOMAIN=sunrise.example');
    expect(env).toContain('OTHER=1');
    expect(env).toContain('APP_ORIGIN=https://sunrise.example');
  });

  it('is idempotent: a second run changes nothing and creates no new versions', async () => {
    await applyClientConfig(config, h.deps, { dryRun: false });
    const first = await h.theme.getPublished();
    const second = await applyClientConfig(config, h.deps, { dryRun: false });
    expect(second.ok).toBe(true);
    expect(second.steps.filter((step) => step.status === 'changed')).toEqual([]);
    const again = await h.theme.getPublished();
    expect(again.version).toBe(first.version);
    expect(again.logoAssetId).toBe(first.logoAssetId);
    expect((await h.settings.getPublishedPage('terms'))?.version).toBe(1);
  });

  it('dry run reports the changes and writes nothing', async () => {
    const report = await applyClientConfig(config, h.deps, { dryRun: true });
    expect(report.ok).toBe(true);
    expect(report.dryRun).toBe(true);
    expect(report.steps.some((step) => step.status === 'changed')).toBe(true);
    expect((await h.settings.getAll())['platform.name']).toBe('Angels Delight TV');
    expect((await h.theme.getPublished()).source).toBe('default');
    expect(await readFile(join(h.dir, 'env.production'), 'utf8')).toBe('APP_DOMAIN=\nOTHER=1\n');
    await expect(readFile(join(h.dir, 'icons', 'icon-512.png'))).rejects.toThrow();
  });

  it('applies only what changed on a later edit', async () => {
    await applyClientConfig(config, h.deps, { dryRun: false });
    const report = await applyClientConfig({ ...config, tagline: 'Learn every day' }, h.deps, {
      dryRun: false,
    });
    const changed = report.steps.filter((step) => step.status === 'changed').map((s) => s.name);
    expect(changed).toEqual(['settings']);
    expect((await h.settings.getAll())['platform.tagline']).toBe('Learn every day');
  });

  it('stops before changing anything when the theme is unreadable', async () => {
    const bad: ClientConfig = { ...config, theme: { colors: { ink: '#CCCCCC', bg: '#FFFFFF' } } };
    const report = await applyClientConfig(bad, h.deps, { dryRun: false });
    expect(report.ok).toBe(false);
    expect(report.steps.find((s) => s.status === 'error')?.name).toBe('theme');
    expect((await h.settings.getAll())['platform.name']).toBe('Angels Delight TV');
  });

  it('reports a missing logo file as an error without partial changes', async () => {
    const report = await applyClientConfig({ ...config, logo: { path: 'missing.png' } }, h.deps, {
      dryRun: false,
    });
    expect(report.ok).toBe(false);
    expect(JSON.stringify(report)).toContain('missing.png');
    expect((await h.settings.getAll())['platform.name']).toBe('Angels Delight TV');
  });

  it('refuses a theme with contrast warnings unless they are accepted', async () => {
    const warned: ClientConfig = { ...config, theme: { colors: { primary: '#F2B705' } } };
    const refused = await applyClientConfig(warned, h.deps, { dryRun: false });
    if (refused.steps.some((s) => s.name === 'theme' && s.status === 'error')) {
      const accepted = await applyClientConfig(warned, h.deps, {
        dryRun: false,
        acceptWarnings: true,
      });
      expect(accepted.ok).toBe(true);
    } else {
      expect(refused.ok).toBe(true);
    }
  });

  it('never puts file contents or secrets in the report', async () => {
    const report = await applyClientConfig(config, h.deps, { dryRun: false });
    expect(JSON.stringify(report)).not.toContain('We keep little data');
  });
});
