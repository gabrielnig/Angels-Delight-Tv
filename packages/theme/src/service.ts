import {
  Conflict,
  Forbidden,
  NotFound,
  ValidationFailed,
  type Actor,
  type Logger,
} from '@ad/shared';
import { COLOR_KEYS, ThemeValidationError } from '@ad/ui';
import { THEME_CACHE_TTL_MS, TtlCache } from './cache';
import { buildThemeCss } from './css';
import { evaluateTheme, type GateResult } from './gate';
import { DEFAULT_THEME, parseTheme, type ThemeValues } from './model';
import type { ThemeRow, ThemeStore, ThemeTx } from './store';

export const THEME_ACTIONS = {
  draftSaved: 'theme.draft_save',
  published: 'theme.publish',
  reset: 'theme.reset',
  restored: 'theme.restore',
} as const;

/** Raised when a draft has warnings and the admin has not confirmed them yet (M18-S02 AC2). */
export class WarningsNeedConfirmation extends Conflict {
  constructor(readonly warnings: { id: string; message: string }[]) {
    super('This theme has contrast warnings. Confirm to publish anyway.');
    this.name = 'WarningsNeedConfirmation';
  }
}

export interface PublishedTheme {
  theme: ThemeValues;
  css: string;
  version: number | null;
  logoAssetId: string | null;
  faviconAssetId: string | null;
  /** `default` when nothing is published or the stored theme could not be used. */
  source: 'published' | 'default';
}

export interface ThemeSnapshot {
  id: string;
  version: number;
  status: ThemeRow['status'];
  theme: ThemeValues;
  logoAssetId: string | null;
  faviconAssetId: string | null;
  gate: GateResult;
  createdBy: string | null;
  createdAt: Date;
  publishedAt: Date | null;
}

export interface EditorState {
  working: ThemeValues;
  logoAssetId: string | null;
  faviconAssetId: string | null;
  hasDraft: boolean;
  draftVersion: number | null;
  draftSavedAt: Date | null;
  publishedVersion: number | null;
  publishedAt: Date | null;
  gate: GateResult;
}

export interface HistoryItem {
  id: string;
  version: number;
  /** `published` if it was ever live, otherwise `draft`. */
  status: 'published' | 'draft';
  isCurrent: boolean;
  isDraftInProgress: boolean;
  at: Date;
  by: string | null;
  fontKey: ThemeValues['fontKey'];
  typeScale: number;
  swatches: string[];
  primary: string;
  contrast: number;
  contrastLevel: 'pass' | 'warn' | 'block';
}

export interface HistoryPage {
  items: HistoryItem[];
  total: number;
  /** Pass as `beforeVersion` to load older versions, or null at the end. */
  nextBefore: number | null;
}

export interface ThemeServiceOptions {
  store: ThemeStore;
  logger: Logger;
  now?: () => number;
  cacheTtlMs?: number;
}

export interface DraftAssets {
  logoAssetId?: string | null;
  faviconAssetId?: string | null;
}

const FALLBACK_TTL_MS = 5_000;

function assertAdmin(actor: Actor): void {
  if (actor.role !== 'admin') throw new Forbidden('Only an admin can change the theme');
}

function toValidationError(error: unknown): never {
  if (error instanceof ThemeValidationError) {
    const fields: Record<string, string[]> = {};
    for (const issue of error.issues) (fields[issue.field || 'theme'] ??= []).push(issue.message);
    throw new ValidationFailed(fields, 'The theme has invalid values');
  }
  throw error;
}

export class ThemeService {
  private readonly cache: TtlCache<PublishedTheme>;
  private readonly store: ThemeStore;
  private readonly logger: Logger;

  constructor(options: ThemeServiceOptions) {
    this.store = options.store;
    this.logger = options.logger;
    this.cache = new TtlCache(options.cacheTtlMs ?? THEME_CACHE_TTL_MS, options.now);
  }

  /** The published theme for rendering. Never throws: any failure returns the default theme (M18-S07 AC3). */
  async getPublished(): Promise<PublishedTheme> {
    const cached = this.cache.get();
    if (cached) return cached;
    let row: ThemeRow | null;
    try {
      row = await this.store.published();
    } catch (error) {
      this.logger.error('theme read failed, using defaults', { error });
      return this.cacheFallback();
    }
    if (!row) return this.cacheDefault();
    try {
      const theme = parseTheme(row.tokens);
      const value: PublishedTheme = {
        theme,
        css: buildThemeCss(theme),
        version: row.version,
        logoAssetId: row.logoAssetId,
        faviconAssetId: row.faviconAssetId,
        source: 'published',
      };
      this.cache.set(value);
      return value;
    } catch (error) {
      this.logger.error('stored theme is invalid, using defaults', { version: row.version, error });
      return this.cacheFallback();
    }
  }

  private defaultValue(): PublishedTheme {
    return {
      theme: DEFAULT_THEME,
      css: buildThemeCss(DEFAULT_THEME),
      version: null,
      logoAssetId: null,
      faviconAssetId: null,
      source: 'default',
    };
  }

  private cacheDefault(): PublishedTheme {
    const value = this.defaultValue();
    this.cache.set(value);
    return value;
  }

  private cacheFallback(): PublishedTheme {
    const value = this.defaultValue();
    this.cache.set(value, FALLBACK_TTL_MS);
    return value;
  }

  /** Drops the cached theme on this instance. Other instances pick up the change within the ttl. */
  bustCache(): void {
    this.cache.bust();
  }

  async getEditorState(actor: Actor): Promise<EditorState> {
    assertAdmin(actor);
    const { draft, published } = await this.store.transaction(async (tx) => ({
      draft: await tx.findByStatus('draft'),
      published: await tx.findByStatus('published'),
    }));
    const source = draft ?? published;
    const working = this.readTheme(source);
    return {
      working,
      logoAssetId: source?.logoAssetId ?? null,
      faviconAssetId: source?.faviconAssetId ?? null,
      hasDraft: draft !== null,
      draftVersion: draft?.version ?? null,
      draftSavedAt: draft?.createdAt ?? null,
      publishedVersion: published?.version ?? null,
      publishedAt: published?.publishedAt ?? null,
      gate: evaluateTheme(working),
    };
  }

  private readTheme(row: ThemeRow | null): ThemeValues {
    if (!row) return DEFAULT_THEME;
    try {
      return parseTheme(row.tokens);
    } catch (error) {
      this.logger.error('stored theme is invalid, showing defaults in the editor', {
        version: row.version,
        error,
      });
      return DEFAULT_THEME;
    }
  }

  private snapshot(row: ThemeRow): ThemeSnapshot {
    const theme = this.readTheme(row);
    return {
      id: row.id,
      version: row.version,
      status: row.status,
      theme,
      logoAssetId: row.logoAssetId,
      faviconAssetId: row.faviconAssetId,
      gate: evaluateTheme(theme),
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      publishedAt: row.publishedAt,
    };
  }

  /** Creates the draft, or updates it in place. Blocked themes (D-007) are never stored. */
  async saveDraft(actor: Actor, input: unknown, assets: DraftAssets = {}): Promise<ThemeSnapshot> {
    assertAdmin(actor);
    let theme: ThemeValues;
    try {
      theme = parseTheme(input);
    } catch (error) {
      return toValidationError(error);
    }
    const gate = evaluateTheme(theme);
    if (gate.blocked) {
      throw new ValidationFailed(
        { theme: gate.blockers.map((check) => check.message) },
        'This theme cannot be saved because some text would be too hard to read',
      );
    }
    const row = await this.store.transaction(async (tx) => {
      const existing = await tx.findByStatus('draft');
      const logoAssetId =
        assets.logoAssetId !== undefined ? assets.logoAssetId : (existing?.logoAssetId ?? null);
      const faviconAssetId =
        assets.faviconAssetId !== undefined
          ? assets.faviconAssetId
          : (existing?.faviconAssetId ?? null);
      const saved = existing
        ? await tx.update(existing.id, {
            tokens: theme,
            logoAssetId,
            faviconAssetId,
            createdBy: actor.accountId,
          })
        : await tx.insert({
            status: 'draft',
            version: await tx.nextVersion(),
            tokens: theme,
            logoAssetId,
            faviconAssetId,
            createdBy: actor.accountId,
            publishedAt: null,
          });
      await tx.audit({
        action: THEME_ACTIONS.draftSaved,
        actorAccountId: actor.accountId,
        actorRole: actor.role,
        targetType: 'theme',
        targetId: saved.id,
        outcome: 'success',
        metadata: { version: saved.version, warnings: gate.warnings.map((check) => check.id) },
      });
      return saved;
    });
    return this.snapshot(row);
  }

  async publish(actor: Actor, options: { acknowledgeWarnings?: boolean }): Promise<ThemeSnapshot> {
    assertAdmin(actor);
    const row = await this.store.transaction(async (tx) => {
      const draft = await tx.findByStatus('draft');
      if (!draft) throw new NotFound('There is no draft to publish');
      const theme = this.readTheme(draft);
      const gate = evaluateTheme(theme);
      if (gate.blocked) {
        throw new ValidationFailed(
          { theme: gate.blockers.map((check) => check.message) },
          'This theme cannot be published because some text would be too hard to read',
        );
      }
      if (gate.requiresAcknowledgement && !options.acknowledgeWarnings) {
        throw new WarningsNeedConfirmation(
          gate.warnings.map((check) => ({ id: check.id, message: check.message })),
        );
      }
      const previous = await tx.findByStatus('published');
      if (previous) await tx.update(previous.id, { status: 'archived' });
      const live = await tx.update(draft.id, {
        status: 'published',
        publishedAt: new Date(),
        createdBy: draft.createdBy ?? actor.accountId,
      });
      await tx.audit({
        action: THEME_ACTIONS.published,
        actorAccountId: actor.accountId,
        actorRole: actor.role,
        targetType: 'theme',
        targetId: live.id,
        outcome: 'success',
        metadata: {
          version: live.version,
          previousVersion: previous?.version ?? null,
          acknowledgedWarnings: gate.warnings.map((check) => check.id),
        },
      });
      return live;
    });
    this.bustCache();
    return this.snapshot(row);
  }

  /** Starts a fresh draft from the code defaults. History is kept (M18-S07 AC2). */
  async resetToDefault(actor: Actor): Promise<ThemeSnapshot> {
    assertAdmin(actor);
    const row = await this.replaceDraft(actor, DEFAULT_THEME, null, null, THEME_ACTIONS.reset, {});
    return this.snapshot(row);
  }

  async restoreVersion(actor: Actor, id: string): Promise<ThemeSnapshot> {
    assertAdmin(actor);
    const source = await this.store.transaction((tx) => tx.findById(id));
    if (!source) throw new NotFound('That version does not exist');
    const theme = this.readTheme(source);
    const row = await this.replaceDraft(
      actor,
      theme,
      source.logoAssetId,
      source.faviconAssetId,
      THEME_ACTIONS.restored,
      { fromVersion: source.version },
    );
    return this.snapshot(row);
  }

  /** Archives the current draft, so it stays in history, and inserts a new one. */
  private async replaceDraft(
    actor: Actor,
    theme: ThemeValues,
    logoAssetId: string | null,
    faviconAssetId: string | null,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<ThemeRow> {
    return this.store.transaction(async (tx) => {
      const existing = await tx.findByStatus('draft');
      if (existing) await tx.update(existing.id, { status: 'archived' });
      const row = await tx.insert({
        status: 'draft',
        version: await tx.nextVersion(),
        tokens: theme,
        logoAssetId,
        faviconAssetId,
        createdBy: actor.accountId,
        publishedAt: null,
      });
      await tx.audit({
        action,
        actorAccountId: actor.accountId,
        actorRole: actor.role,
        targetType: 'theme',
        targetId: row.id,
        outcome: 'success',
        metadata: { version: row.version, replacedDraft: existing?.version ?? null, ...metadata },
      });
      return row;
    });
  }

  async getVersion(actor: Actor, id: string): Promise<ThemeSnapshot> {
    assertAdmin(actor);
    const row = await this.store.transaction((tx) => tx.findById(id));
    if (!row) throw new NotFound('That version does not exist');
    return this.snapshot(row);
  }

  async listHistory(
    actor: Actor,
    options: { filter?: 'all' | 'published' | 'draft'; limit?: number; beforeVersion?: number },
  ): Promise<HistoryPage> {
    assertAdmin(actor);
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const kind = options.filter && options.filter !== 'all' ? options.filter : undefined;
    const { rows, total } = await this.store.transaction(async (tx) => ({
      rows: await tx.list({ kind, limit: limit + 1, beforeVersion: options.beforeVersion }),
      total: await tx.count(kind),
    }));
    const page = rows.slice(0, limit);
    const items = page.map((row): HistoryItem => {
      const theme = this.readTheme(row);
      const gate = evaluateTheme(theme);
      const primaryCheck = gate.checks.find((check) => check.id === 'on-primary')!;
      return {
        id: row.id,
        version: row.version,
        status: row.publishedAt ? 'published' : 'draft',
        isCurrent: row.status === 'published',
        isDraftInProgress: row.status === 'draft',
        at: row.publishedAt ?? row.createdAt,
        by: row.createdBy,
        fontKey: theme.fontKey,
        typeScale: theme.typeScale,
        swatches: COLOR_KEYS.map((key) => theme.colors[key]),
        primary: theme.colors.primary,
        contrast: primaryCheck.ratio,
        contrastLevel: primaryCheck.level,
      };
    });
    const last = page.at(-1);
    return { items, total, nextBefore: rows.length > limit && last ? last.version : null };
  }
}

export type { ThemeTx };
