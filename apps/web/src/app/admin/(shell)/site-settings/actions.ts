'use server';

import { revalidatePath } from 'next/cache';
import type { PageSlug } from '@ad/theme/client';
import { requireActionActor } from '@/lib/data/admin/session-next';
import { siteSettingsAdmin } from '@/lib/data/admin/site-settings';
import { inviteCodesAdmin } from '@/lib/data/admin/invite-codes';
import type {
  InviteCodeInput,
  InviteCodeResult,
  PageDto,
  SiteSettingsDto,
} from '@/lib/data/admin/site-types';
import type { ActionResult } from '@/lib/data/admin/theme-types';

const NEXT = '/admin/site-settings';

export async function updateSettingsAction(
  changes: Record<string, unknown>,
): Promise<ActionResult<SiteSettingsDto>> {
  const actor = await requireActionActor(NEXT);
  const result = await siteSettingsAdmin.update(actor, changes);
  if (result.ok) revalidatePath(NEXT);
  return result;
}

export async function savePageAction(slug: PageSlug, body: string): Promise<ActionResult<PageDto>> {
  const actor = await requireActionActor(NEXT);
  return siteSettingsAdmin.savePage(actor, slug, body);
}

export async function publishPageAction(slug: PageSlug): Promise<ActionResult<SiteSettingsDto>> {
  const actor = await requireActionActor(NEXT);
  const result = await siteSettingsAdmin.publishPage(actor, slug);
  if (result.ok) revalidatePath(NEXT);
  return result;
}

export async function restorePageAction(
  slug: PageSlug,
  version: number,
): Promise<ActionResult<PageDto>> {
  const actor = await requireActionActor(NEXT);
  return siteSettingsAdmin.restorePage(actor, slug, version);
}

export async function createInviteCodeAction(input: InviteCodeInput): Promise<InviteCodeResult> {
  const actor = await requireActionActor(NEXT);
  return inviteCodesAdmin.create(actor, input);
}

export async function revokeInviteCodeAction(id: string): Promise<InviteCodeResult> {
  const actor = await requireActionActor(NEXT);
  return inviteCodesAdmin.revoke(actor, id);
}
