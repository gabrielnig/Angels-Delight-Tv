'use server';

import { Forbidden, RateLimited, ValidationFailed } from '@ad/shared';
import type { MessageText } from '@ad/shared/messages';
import { requireActionActor, spendAdminBudget } from '@/lib/data/admin/session-next';
import { translationServiceFor } from '@/lib/i18n/runtime';

const LIST = '/admin/languages';

type Fail = { ok: false; error: string };

function failure(error: unknown): Fail {
  if (error instanceof Forbidden) return { ok: false, error: 'You do not have permission to do this.' };
  if (error instanceof RateLimited) return { ok: false, error: 'Too many requests. Wait a moment and try again.' };
  if (error instanceof ValidationFailed) return { ok: false, error: error.message };
  return { ok: false, error: 'That did not work. Nothing was changed. Try again.' };
}

export async function saveTranslationAction(locale: string, key: string, text: MessageText) {
  try {
    const actor = await requireActionActor(`${LIST}/${locale}`);
    await spendAdminBudget(actor);
    const { warnings } = await (await translationServiceFor(actor)).save(actor, locale, key, text);
    return { ok: true as const, warnings };
  } catch (error) {
    return failure(error);
  }
}

export async function approveTranslationsAction(locale: string, keys: string[]) {
  const actor = await requireActionActor(`${LIST}/${locale}`);
  await spendAdminBudget(actor);
  return (await translationServiceFor(actor)).approveMany(actor, locale, keys);
}

export async function publishLanguageAction(locale: string, override?: { reason: string }) {
  try {
    const actor = await requireActionActor(LIST);
    await spendAdminBudget(actor);
    await (await translationServiceFor(actor)).publish(actor, locale, override ? { override } : {});
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function unpublishLanguageAction(locale: string) {
  try {
    const actor = await requireActionActor(LIST);
    await spendAdminBudget(actor);
    await (await translationServiceFor(actor)).unpublish(actor, locale);
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}

export async function loadDraftsAction(locale: string) {
  try {
    const actor = await requireActionActor(`${LIST}/${locale}`);
    await spendAdminBudget(actor);
    const result = await (await translationServiceFor(actor)).loadDrafts(actor, locale);
    return { ok: true as const, ...result };
  } catch (error) {
    return failure(error);
  }
}
