import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { ValidationFailed, type Actor } from '@ad/shared';
import {
  processBrandImage,
  sanitizeHtml,
  type LogoUploader,
  type PageSlug,
  type ResolvedSettings,
  type SettingsService,
  type ThemeService,
} from '@ad/theme';
import { launchHomeConfig, type HomeConfig } from '@ad/catalog';
import { checkClientTheme, type ClientConfig } from './client-config';
import { envValuesFor, updateEnvText } from './env-file';
import { generatePwaIcons } from './pwa-icons';

export interface ApplyDeps {
  settings: Pick<
    SettingsService,
    'getAll' | 'update' | 'getPage' | 'savePageDraft' | 'publishPage'
  >;
  theme: Pick<ThemeService, 'getPublished' | 'saveDraft' | 'publish'>;
  logos: Pick<LogoUploader, 'upload' | 'get'>;
  /** An existing admin: the account named as `adminOwnerEmail`. Every change is audited as this account. */
  actor: Actor;
  /** Relative paths in the config are read from here. */
  baseDir: string;
  /** Where the home screen icons are written. Omit to skip them. */
  iconsDir?: string;
  /** Seeds the launch sections on Home. Omit to skip the step. */
  home?: HomeSeeder;
  /** The env file to update with domain and contact values. Omit to skip it. */
  envFile?: string;
}

/** The two things the apply tool needs from the admin home service. The command line wires these to the catalog. */
export interface HomeSeeder {
  hasPublished(): Promise<boolean>;
  publish(actor: Actor, config: HomeConfig): Promise<{ ok: true } | { ok: false; error: string }>;
}

export interface ApplyOptions {
  dryRun: boolean;
  /** Publish a theme whose contrast checks only warn (the admin editor asks for the same confirmation). */
  acceptWarnings?: boolean;
}

export type StepStatus = 'changed' | 'unchanged' | 'skipped' | 'error';

export interface StepReport {
  name: string;
  status: StepStatus;
  /** Field names and counts only. Never file contents or secrets. */
  details: string[];
}

export interface ApplyReport {
  ok: boolean;
  dryRun: boolean;
  steps: StepReport[];
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

class StepError extends Error {
  constructor(
    readonly step: string,
    message: string,
  ) {
    super(message);
  }
}

function describeError(error: unknown): string {
  if (error instanceof ValidationFailed) {
    const fields = Object.values(error.fields ?? {}).flat();
    return fields.length ? fields.join(' ') : error.message;
  }
  return error instanceof Error ? error.message : 'Unknown error';
}

/** What the config says the settings table should hold, for the keys the config mentions. */
export function desiredSettings(config: ClientConfig): Partial<ResolvedSettings> {
  const out: Record<string, unknown> = {
    'platform.name': config.platformName,
    'platform.canonical_host': config.domain,
    'platform.support_email': config.supportEmail,
  };
  if (config.tagline !== undefined) out['platform.tagline'] = config.tagline;
  if (config.guestAudience !== undefined) out['features.guest_audience'] = config.guestAudience;
  if (config.guestPlay !== undefined) out['features.guest_play'] = config.guestPlay;
  if (config.footerText !== undefined) out['platform.footer_text'] = config.footerText;
  if (config.socialLinks !== undefined) out['platform.social_links'] = config.socialLinks;
  if (config.home?.continueTitle !== undefined) out['home.continue_title'] = config.home.continueTitle;
  if (config.languages) {
    out['content.default_language'] = config.languages.default;
    out['content.languages'] = config.languages.offered;
    if (config.languages.ui) out['content.ui_languages'] = config.languages.ui as never;
  }
  return out as Partial<ResolvedSettings>;
}

/**
 * Applies the client's details through the same services the admin screens use, so validation, audit rows and cache
 * busting are identical. Reads everything first and changes nothing when any check fails. Every step compares with
 * what is stored, so a second run reports `unchanged` and writes nothing. With `dryRun` nothing is written at all.
 */
export async function applyClientConfig(
  config: ClientConfig,
  deps: ApplyDeps,
  options: ApplyOptions,
): Promise<ApplyReport> {
  const steps: StepReport[] = [];
  const add = (name: string, status: StepStatus, details: string[] = []) =>
    steps.push({ name, status, details });
  const path = (value: string) => (isAbsolute(value) ? value : resolve(deps.baseDir, value));

  // ---- Phase 1: read and validate, no writes ----
  let logoBytes: Buffer | null = null;
  let faviconBytes: Buffer | null = null;
  const pages: { slug: PageSlug; html: string }[] = [];
  let themeCheck: ReturnType<typeof checkClientTheme> | null = null;
  try {
    for (const [kind, ref] of [
      ['logo', config.logo],
      ['favicon', config.favicon],
    ] as const) {
      if (!ref) continue;
      let bytes: Buffer;
      try {
        bytes = await readFile(path(ref.path));
      } catch {
        throw new StepError(kind, `Cannot read ${ref.path}`);
      }
      try {
        await processBrandImage(bytes, kind);
      } catch (error) {
        throw new StepError(kind, `${ref.path}: ${describeError(error)}`);
      }
      if (kind === 'logo') logoBytes = bytes;
      else faviconBytes = bytes;
    }
    for (const slug of ['terms', 'privacy', 'about', 'help'] as const) {
      const page = config.legal?.[slug];
      if (!page) continue;
      let html: string;
      if (page.html !== undefined) html = page.html;
      else {
        try {
          html = await readFile(path(page.file!), 'utf8');
        } catch {
          throw new StepError('legal', `Cannot read ${page.file}`);
        }
      }
      pages.push({ slug, html });
    }
    if (config.theme) {
      themeCheck = checkClientTheme(config.theme);
      if (themeCheck.blocked) throw new StepError('theme', themeCheck.messages.join(' '));
      if (themeCheck.warnings.length > 0 && !options.acceptWarnings) {
        throw new StepError(
          'theme',
          `Contrast warnings need confirmation (--accept-warnings): ${themeCheck.warnings.join(' ')}`,
        );
      }
    }
  } catch (error) {
    if (error instanceof StepError) {
      add(error.step, 'error', [error.message]);
      return { ok: false, dryRun: options.dryRun, steps };
    }
    throw error;
  }

  // ---- Phase 2: compare and apply ----
  try {
    // Settings
    const current = await deps.settings.getAll();
    const wanted = desiredSettings(config) as Record<string, unknown>;
    const differing = Object.keys(wanted).filter(
      (key) => !same((current as Record<string, unknown>)[key], wanted[key]),
    );
    if (differing.length > 0) {
      if (!options.dryRun) await deps.settings.update(deps.actor, wanted as never);
      add('settings', 'changed', differing);
    } else add('settings', 'unchanged');

    // Logo and favicon assets
    const published = await deps.theme.getPublished();
    const assetIds: { logo: string | null; favicon: string | null } = {
      logo: published.logoAssetId,
      favicon: published.faviconAssetId,
    };
    let assetsChanged = false;
    for (const [kind, ref, bytes] of [
      ['logo', config.logo, logoBytes],
      ['favicon', config.favicon, faviconBytes],
    ] as const) {
      if (!ref || !bytes) {
        add(kind, 'skipped', ['not in the config']);
        continue;
      }
      const existing = assetIds[kind] ? await deps.logos.get(assetIds[kind]!) : null;
      if (existing && existing.sha256.toString('hex') === sha256(bytes)) {
        add(kind, 'unchanged');
        continue;
      }
      assetsChanged = true;
      if (options.dryRun) {
        add(kind, 'changed', ['would upload']);
        continue;
      }
      const stored = await deps.logos.upload(deps.actor, bytes, {
        purpose: kind,
        altText: kind === 'logo' ? (ref.altText ?? config.platformName) : null,
      });
      assetIds[kind] = stored.id;
      add(kind, 'changed', ['uploaded']);
    }

    // Theme
    const desiredTheme = themeCheck?.theme ?? published.theme;
    if (!config.theme && !config.logo && !config.favicon) {
      add('theme', 'skipped', ['not in the config']);
    } else if (
      !assetsChanged &&
      published.source === 'published' &&
      same(desiredTheme, published.theme)
    ) {
      add('theme', 'unchanged');
    } else {
      if (!options.dryRun) {
        await deps.theme.saveDraft(deps.actor, desiredTheme, {
          logoAssetId: assetIds.logo,
          faviconAssetId: assetIds.favicon,
        });
        await deps.theme.publish(deps.actor, { acknowledgeWarnings: options.acceptWarnings });
      }
      add('theme', 'changed', ['published']);
    }

    // Legal and info pages
    if (pages.length === 0) add('legal', 'skipped', ['not in the config']);
    else {
      const changed: string[] = [];
      for (const { slug, html } of pages) {
        const view = await deps.settings.getPage(deps.actor, slug);
        if (view.published && view.published.body === sanitizeHtml(html)) continue;
        if (!options.dryRun) {
          await deps.settings.savePageDraft(deps.actor, slug, html);
          await deps.settings.publishPage(deps.actor, slug);
        }
        changed.push(slug);
      }
      add('legal', changed.length ? 'changed' : 'unchanged', changed);
    }

    // Home sections: seeded once, never over a layout that exists
    if (!deps.home) add('home', 'skipped', ['no home service']);
    else if (config.home?.seedDefaults === false) add('home', 'skipped', ['home.seedDefaults is false']);
    else if (await deps.home.hasPublished()) add('home', 'unchanged');
    else {
      const layout = launchHomeConfig(config.home);
      if (!options.dryRun) {
        const result = await deps.home.publish(deps.actor, layout);
        if (!result.ok) throw new Error(`Home sections: ${result.error}`);
      }
      add('home', 'changed', [
        ...(options.dryRun ? [`would seed ${layout.rows.length} sections`] : []),
        ...layout.rows.map((row) => row.name),
      ]);
    }

    // Home screen icons
    if (!deps.iconsDir || !logoBytes) add('icons', 'skipped', ['needs a logo and an icons folder']);
    else {
      const icons = await generatePwaIcons(logoBytes, { background: desiredTheme.colors.primary });
      const changed: string[] = [];
      for (const icon of icons) {
        const file = join(deps.iconsDir, icon.name);
        const existing = await readFile(file).catch(() => null);
        if (existing && existing.equals(icon.bytes)) continue;
        if (!options.dryRun) {
          await mkdir(deps.iconsDir, { recursive: true });
          await writeFile(file, icon.bytes);
        }
        changed.push(icon.name);
      }
      add('icons', changed.length ? 'changed' : 'unchanged', changed);
    }

    // Env file values
    if (!deps.envFile) add('env', 'skipped', ['no env file given']);
    else {
      const text = await readFile(deps.envFile, 'utf8').catch(() => null);
      if (text === null) add('env', 'skipped', ['env file not found']);
      else {
        const result = updateEnvText(text, envValuesFor(config));
        if (result.changes.length === 0) add('env', 'unchanged');
        else {
          if (!options.dryRun) await writeFile(deps.envFile, result.text);
          add(
            'env',
            'changed',
            result.changes.map((change) => change.name),
          );
        }
      }
    }
  } catch (error) {
    add('apply', 'error', [describeError(error)]);
    return { ok: false, dryRun: options.dryRun, steps };
  }
  return { ok: true, dryRun: options.dryRun, steps };
}
