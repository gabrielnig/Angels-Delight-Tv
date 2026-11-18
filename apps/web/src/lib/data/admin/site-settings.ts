import 'server-only';
import { Forbidden, type Actor } from '@ad/shared';
import { PAGE_SLUGS, type PageSlug } from '@ad/theme/client';
import type { PageView } from '@ad/theme';
import { can } from '@/lib/admin/can';
import { themeRuntime } from './theme-runtime';
import { toResult } from './theme';
import type { ActionResult } from './theme-types';
import type { PageDto, SiteSettingsDto } from './site-types';
import type { AdminActor } from './types';

/** Typed data access for S64. Same rules as the theme facade: permission on every call, plain results. */

const toActor = (actor: AdminActor): Actor => ({ accountId: actor.accountId, role: actor.role });

function guard(actor: AdminActor): void {
  if (!can(actor.role, 'settings.site'))
    throw new Forbidden('You do not have access to site settings');
}

function pageDto(view: PageView): PageDto {
  return {
    slug: view.slug,
    title: view.title,
    draftBody: view.draftBody,
    hasDraft: view.hasDraft,
    published: view.published,
    versions: view.versions,
    isPlaceholder: view.isPlaceholder,
  };
}

async function load(actor: AdminActor): Promise<SiteSettingsDto> {
  const { settings } = await themeRuntime();
  const a = toActor(actor);
  const [fields, checklist, ...pages] = await Promise.all([
    settings.listFields(a),
    settings.launchChecklist(a),
    ...PAGE_SLUGS.map((slug) => settings.getPage(a, slug)),
  ]);
  return {
    values: Object.fromEntries(fields.map((field) => [field.key, field.value])),
    checklist,
    pages: Object.fromEntries(pages.map((page) => [page.slug, pageDto(page)])) as Record<
      PageSlug,
      PageDto
    >,
    canChangeFlags: can(actor.role, 'settings.flags'),
  };
}

export const siteSettingsAdmin = {
  load: (actor: AdminActor) => toResult(async () => (guard(actor), load(actor))),

  update: (actor: AdminActor, changes: Record<string, unknown>) =>
    toResult(async () => {
      guard(actor);
      const { settings } = await themeRuntime();
      await settings.update(toActor(actor), changes);
      return load(actor);
    }),

  savePage: (actor: AdminActor, slug: PageSlug, body: string) =>
    toResult(async () => {
      guard(actor);
      const { settings } = await themeRuntime();
      return pageDto(await settings.savePageDraft(toActor(actor), slug, body));
    }),

  publishPage: (actor: AdminActor, slug: PageSlug) =>
    toResult(async () => {
      guard(actor);
      const { settings } = await themeRuntime();
      await settings.publishPage(toActor(actor), slug);
      return load(actor);
    }),

  restorePage: (actor: AdminActor, slug: PageSlug, version: number) =>
    toResult(async () => {
      guard(actor);
      const { settings } = await themeRuntime();
      return pageDto(await settings.restorePageVersion(toActor(actor), slug, version));
    }),
};

export type { ActionResult };
