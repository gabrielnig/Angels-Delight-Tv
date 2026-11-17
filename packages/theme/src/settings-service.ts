import { Forbidden, NotFound, ValidationFailed, type Actor, type Logger } from '@ad/shared';
import { z } from 'zod';
import { THEME_CACHE_TTL_MS, TtlCache } from './cache';
import { PAGE_SLUGS, PAGE_TITLES, type PageSlug } from './page-meta';
import { isPlaceholderBody, sanitizeHtml } from './html-sanitize';
import {
  PUBLIC_SETTING_KEYS,
  SETTING_DEFS,
  SETTING_KEYS,
  defaultSettings,
  isSettingKey,
  type PublicSettings,
  type ResolvedSettings,
  type SettingGroup,
  type SettingKey,
  type SettingTier,
} from './settings-registry';
import type { SettingsStore, SettingsTx } from './settings-store';

export const SETTINGS_ACTIONS = {
  changed: 'settings.change',
  pageDraftSaved: 'page.draft_save',
  pagePublished: 'page.publish',
  pageRestored: 'page.restore',
} as const;

export { PAGE_SLUGS, PAGE_TITLES, type PageSlug } from './page-meta';

export const PAGE_PLACEHOLDERS: Record<PageSlug, string> = {
  terms: '<p>[Add your terms of use here before launch]</p>',
  privacy: '<p>[Add your privacy policy here before launch]</p>',
  about: '<p>[Add your about page here before launch]</p>',
  help: '<p>[Add your help page here before launch]</p>',
};

const MAX_PAGE_CHARS = 200_000;
const MAX_VERSIONS = 50;

const pageDocSchema = z.object({
  draft: z.object({ body: z.string(), savedAt: z.string(), savedBy: z.string() }).nullable(),
  versions: z
    .array(
      z.object({
        version: z.number().int().min(1),
        body: z.string(),
        publishedAt: z.string(),
        publishedBy: z.string(),
      }),
    )
    .max(MAX_VERSIONS),
});
type PageDoc = z.infer<typeof pageDocSchema>;

export interface PageVersionInfo {
  version: number;
  publishedAt: string;
  publishedBy: string;
}

export interface PageView {
  slug: PageSlug;
  title: string;
  /** What the editor shows: the draft, else the live version, else placeholder text. */
  draftBody: string;
  hasDraft: boolean;
  published: { version: number; body: string; publishedAt: string } | null;
  versions: PageVersionInfo[];
  isPlaceholder: boolean;
}

export interface PublishedPage {
  slug: PageSlug;
  title: string;
  html: string;
  version: number;
  updatedAt: string;
}

export interface SettingField {
  key: SettingKey;
  value: unknown;
  default: unknown;
  label: string;
  description: string;
  group: SettingGroup;
  tier: SettingTier;
  isPublic: boolean;
}

export interface ChecklistItem {
  id: 'name_tagline' | 'support_email' | 'terms' | 'privacy' | 'domain';
  label: string;
  done: boolean;
  detail: string;
}

export interface SettingsServiceOptions {
  store: SettingsStore;
  logger: Logger;
  now?: () => number;
  /** Who may change `super` tier keys. Defaults to any admin until a super admin role exists (D-034). */
  isSuper?: (actor: Actor) => boolean;
}

function assertAdmin(actor: Actor): void {
  if (actor.role !== 'admin') throw new Forbidden('Only an admin can change site settings');
}

function assertSlug(slug: string): asserts slug is PageSlug {
  if (!(PAGE_SLUGS as readonly string[]).includes(slug))
    throw new NotFound('That page does not exist');
}

const pageKey = (slug: PageSlug) => `pages.${slug}`;

export class SettingsService {
  private readonly store: SettingsStore;
  private readonly logger: Logger;
  private readonly isSuper: (actor: Actor) => boolean;
  private readonly cache: TtlCache<ResolvedSettings>;
  private readonly pageCache = new Map<PageSlug, TtlCache<PublishedPage | null>>();
  private readonly now: () => number;

  constructor(options: SettingsServiceOptions) {
    this.store = options.store;
    this.logger = options.logger;
    this.now = options.now ?? Date.now;
    this.isSuper = options.isSuper ?? ((actor) => actor.role === 'admin');
    this.cache = new TtlCache(THEME_CACHE_TTL_MS, this.now);
  }

  /** All settings with defaults filled in. Never throws: a failed read returns the compiled defaults. */
  async getAll(): Promise<ResolvedSettings> {
    const cached = this.cache.get();
    if (cached) return cached;
    const resolved = defaultSettings();
    try {
      const rows = await this.store.readAll();
      for (const row of rows) {
        if (!isSettingKey(row.key)) continue;
        const parsed = SETTING_DEFS[row.key].schema.safeParse(row.value);
        if (parsed.success) (resolved as Record<string, unknown>)[row.key] = parsed.data;
        else this.logger.warn('stored setting is invalid, using the default', { key: row.key });
      }
      this.cache.set(resolved);
    } catch (error) {
      this.logger.error('settings read failed, using defaults', { error });
      this.cache.set(defaultSettings(), 5_000);
      return defaultSettings();
    }
    return resolved;
  }

  async get<K extends SettingKey>(key: K): Promise<ResolvedSettings[K]> {
    return (await this.getAll())[key];
  }

  /** The values safe to send to the browser. */
  async getPublic(): Promise<PublicSettings> {
    const all = await this.getAll();
    return Object.fromEntries(PUBLIC_SETTING_KEYS.map((key) => [key, all[key]])) as PublicSettings;
  }

  bustCache(): void {
    this.cache.bust();
    this.pageCache.clear();
  }

  async listFields(actor: Actor): Promise<SettingField[]> {
    assertAdmin(actor);
    const all = await this.getAll();
    return SETTING_KEYS.map((key) => ({
      key,
      value: all[key],
      default: SETTING_DEFS[key].default,
      label: SETTING_DEFS[key].label,
      description: SETTING_DEFS[key].description,
      group: SETTING_DEFS[key].group,
      tier: SETTING_DEFS[key].tier,
      isPublic: SETTING_DEFS[key].isPublic,
    }));
  }

  /** Validates every change first, then saves them together with one audit entry listing old and new values. */
  async update(
    actor: Actor,
    changes: Partial<{ [K in SettingKey]: unknown }>,
  ): Promise<ResolvedSettings> {
    assertAdmin(actor);
    const errors: Record<string, string[]> = Object.create(null) as Record<string, string[]>;
    const valid: [SettingKey, unknown][] = [];
    for (const key of Object.keys(changes)) {
      if (!isSettingKey(key)) {
        errors[key] = ['This setting does not exist'];
        continue;
      }
      if (SETTING_DEFS[key].tier === 'super' && !this.isSuper(actor)) {
        throw new Forbidden('Only a super admin can change this setting');
      }
      const parsed = SETTING_DEFS[key].schema.safeParse((changes as Record<string, unknown>)[key]);
      if (parsed.success) valid.push([key, parsed.data]);
      else errors[key] = parsed.error.issues.map((issue) => issue.message);
    }
    if (Object.keys(errors).length > 0)
      throw new ValidationFailed(errors, 'Some settings are not valid');

    await this.store.transaction(async (tx) => {
      const diffs: { key: string; old: unknown; new: unknown }[] = [];
      for (const [key, value] of valid) {
        const existing = await tx.get(key);
        const parsedOld = existing ? SETTING_DEFS[key].schema.safeParse(existing.value) : null;
        const old = parsedOld?.success ? parsedOld.data : SETTING_DEFS[key].default;
        if (existing && JSON.stringify(old) === JSON.stringify(value)) continue;
        if (!existing && JSON.stringify(old) === JSON.stringify(value)) continue;
        await tx.upsert({
          key,
          value,
          isPublic: SETTING_DEFS[key].isPublic,
          description: SETTING_DEFS[key].description,
          updatedBy: actor.accountId,
        });
        diffs.push({ key, old, new: value });
      }
      if (diffs.length === 0) return;
      await tx.audit({
        action: SETTINGS_ACTIONS.changed,
        actorAccountId: actor.accountId,
        actorRole: actor.role,
        targetType: 'settings',
        targetId: diffs
          .map((diff) => diff.key)
          .join(',')
          .slice(0, 200),
        outcome: 'success',
        metadata: { changes: diffs },
      });
    });
    this.bustCache();
    return this.getAll();
  }

  // ---- Pages (M26-S02) ----

  private async readDoc(tx: Pick<SettingsTx, 'get'>, slug: PageSlug): Promise<PageDoc> {
    const row = await tx.get(pageKey(slug));
    const parsed = row ? pageDocSchema.safeParse(row.value) : null;
    if (parsed?.success) return parsed.data;
    if (row) this.logger.error('stored page is invalid, starting empty', { slug });
    return { draft: null, versions: [] };
  }

  private view(slug: PageSlug, doc: PageDoc): PageView {
    const live = doc.versions[0] ?? null;
    const draftBody = doc.draft?.body ?? live?.body ?? PAGE_PLACEHOLDERS[slug];
    return {
      slug,
      title: PAGE_TITLES[slug],
      draftBody,
      hasDraft: doc.draft !== null,
      published: live
        ? { version: live.version, body: live.body, publishedAt: live.publishedAt }
        : null,
      versions: doc.versions.map(({ version, publishedAt, publishedBy }) => ({
        version,
        publishedAt,
        publishedBy,
      })),
      isPlaceholder: isPlaceholderBody(live?.body ?? ''),
    };
  }

  async getPage(actor: Actor, slug: PageSlug): Promise<PageView> {
    assertAdmin(actor);
    assertSlug(slug);
    const doc = await this.store.transaction((tx) => this.readDoc(tx, slug));
    return this.view(slug, doc);
  }

  async savePageDraft(actor: Actor, slug: PageSlug, html: string): Promise<PageView> {
    assertAdmin(actor);
    assertSlug(slug);
    if (typeof html !== 'string' || html.length > MAX_PAGE_CHARS) {
      throw new ValidationFailed(
        { body: ['The page is too long. Keep it under 200,000 characters.'] },
        'Page is too long',
      );
    }
    const body = sanitizeHtml(html);
    const doc = await this.store.transaction(async (tx) => {
      const current = await this.readDoc(tx, slug);
      const next: PageDoc = {
        ...current,
        draft: { body, savedAt: new Date(this.now()).toISOString(), savedBy: actor.accountId },
      };
      await tx.upsert({
        key: pageKey(slug),
        value: next,
        isPublic: false,
        updatedBy: actor.accountId,
      });
      return next;
    });
    this.pageCache.delete(slug);
    return this.view(slug, doc);
  }

  async publishPage(actor: Actor, slug: PageSlug): Promise<PageView> {
    assertAdmin(actor);
    assertSlug(slug);
    const doc = await this.store.transaction(async (tx) => {
      const current = await this.readDoc(tx, slug);
      if (!current.draft) throw new NotFound('There is no draft to publish');
      if (isPlaceholderBody(current.draft.body)) {
        throw new ValidationFailed(
          { body: ['Replace the placeholder text before publishing.'] },
          'The page still has placeholder text',
        );
      }
      const version = (current.versions[0]?.version ?? 0) + 1;
      const next: PageDoc = {
        draft: null,
        versions: [
          {
            version,
            body: current.draft.body,
            publishedAt: new Date(this.now()).toISOString(),
            publishedBy: actor.accountId,
          },
          ...current.versions,
        ].slice(0, MAX_VERSIONS),
      };
      await tx.upsert({
        key: pageKey(slug),
        value: next,
        isPublic: false,
        updatedBy: actor.accountId,
      });
      let legalVersion: string | null = null;
      if (slug === 'terms' || slug === 'privacy') {
        const key = slug === 'terms' ? 'legal.terms_version' : 'legal.privacy_version';
        legalVersion = `v${version}`;
        await tx.upsert({ key, value: legalVersion, isPublic: true, updatedBy: actor.accountId });
      }
      await tx.audit({
        action: SETTINGS_ACTIONS.pagePublished,
        actorAccountId: actor.accountId,
        actorRole: actor.role,
        targetType: 'page',
        targetId: slug,
        outcome: 'success',
        metadata: { slug, version, legalVersion },
      });
      return next;
    });
    this.bustCache();
    return this.view(slug, doc);
  }

  async restorePageVersion(actor: Actor, slug: PageSlug, version: number): Promise<PageView> {
    assertAdmin(actor);
    assertSlug(slug);
    const doc = await this.store.transaction(async (tx) => {
      const current = await this.readDoc(tx, slug);
      const source = current.versions.find((item) => item.version === version);
      if (!source) throw new NotFound('That version does not exist');
      const next: PageDoc = {
        ...current,
        draft: {
          body: source.body,
          savedAt: new Date(this.now()).toISOString(),
          savedBy: actor.accountId,
        },
      };
      await tx.upsert({
        key: pageKey(slug),
        value: next,
        isPublic: false,
        updatedBy: actor.accountId,
      });
      await tx.audit({
        action: SETTINGS_ACTIONS.pageRestored,
        actorAccountId: actor.accountId,
        actorRole: actor.role,
        targetType: 'page',
        targetId: slug,
        outcome: 'success',
        metadata: { slug, fromVersion: version },
      });
      return next;
    });
    return this.view(slug, doc);
  }

  /** What viewers see. Null until the first version is published. Cached for 60 seconds. */
  async getPublishedPage(slug: PageSlug): Promise<PublishedPage | null> {
    if (!(PAGE_SLUGS as readonly string[]).includes(slug)) return null;
    let cache = this.pageCache.get(slug);
    if (!cache) {
      cache = new TtlCache<PublishedPage | null>(THEME_CACHE_TTL_MS, this.now);
      this.pageCache.set(slug, cache);
    }
    const cached = cache.get();
    if (cached !== undefined) return cached;
    try {
      const row = await this.store.readOne(pageKey(slug));
      const parsed = row ? pageDocSchema.safeParse(row.value) : null;
      const live = parsed?.success ? parsed.data.versions[0] : undefined;
      const value: PublishedPage | null = live
        ? {
            slug,
            title: PAGE_TITLES[slug],
            html: sanitizeHtml(live.body),
            version: live.version,
            updatedAt: live.publishedAt,
          }
        : null;
      cache.set(value);
      return value;
    } catch (error) {
      this.logger.error('page read failed', { slug, error });
      return null;
    }
  }

  async launchChecklist(actor: Actor): Promise<ChecklistItem[]> {
    assertAdmin(actor);
    const all = await this.getAll();
    const [terms, privacy] = await Promise.all([
      this.getPublishedPage('terms'),
      this.getPublishedPage('privacy'),
    ]);
    const nameSet = all['platform.name'].trim() !== '' && all['platform.tagline'].trim() !== '';
    return [
      {
        id: 'name_tagline',
        label: 'Platform name and tagline',
        done: nameSet,
        detail: nameSet ? 'Set' : 'Add a tagline',
      },
      {
        id: 'support_email',
        label: 'Support email',
        done: all['platform.support_email'] !== '',
        detail: all['platform.support_email'] !== '' ? 'Set' : 'Not set',
      },
      {
        id: 'terms',
        label: 'Terms page',
        done: terms !== null && !isPlaceholderBody(terms.html),
        detail: terms ? 'Published' : 'Terms page has placeholder text',
      },
      {
        id: 'privacy',
        label: 'Privacy page',
        done: privacy !== null && !isPlaceholderBody(privacy.html),
        detail: privacy ? 'Published' : 'Privacy page has placeholder text',
      },
      {
        id: 'domain',
        label: 'Domain connected',
        done: all['platform.canonical_host'] !== '',
        detail: all['platform.canonical_host'] !== '' ? all['platform.canonical_host'] : 'Not set',
      },
    ];
  }
}
