import 'server-only';
import {
  getNotificationPrefs,
  hasNotificationAddress,
  listAdminNotices,
  markAdminNoticesRead,
  saveNotificationAddress,
  setNotificationPrefs,
} from '@ad/catalog';
import { sealPrefsAddress } from '@ad/queue';
import { adminRuntime } from '@/server/admin/runtime';
import type { NoticesService } from '../notices';
import { asResult, catalogActor, context, need } from './shared';

/**
 * Keeps a sealed copy of the person's address next to their choices, because the worker cannot read accounts and
 * still has to mail them (D-129). It is saved the first time the bell loads, and again after an email change,
 * because the database clears the old copy then. It never fails the page: without a copy the worker skips the
 * person and says so in its log.
 */
async function ensureAddress(actor: Parameters<NoticesService['feed']>[0]): Promise<void> {
  try {
    const ctx = await context();
    const who = catalogActor(actor);
    if (await hasNotificationAddress(ctx, who)) return;
    const runtime = adminRuntime();
    // getOverview only reads the account, so a missing session id (tests, background callers) does not matter.
    const { email } = await runtime.auth().staff.getOverview({
      accountId: actor.accountId,
      role: actor.role as 'editor' | 'admin' | 'super_admin',
      sessionId: actor.sessionId ?? '',
    });
    await saveNotificationAddress(
      ctx,
      who,
      sealPrefsAddress(runtime.fieldKek(), actor.accountId, email),
    );
  } catch {
    // Reading the bell matters more than saving the copy; the next page load tries again.
  }
}

/** The bell and the email choices for staff (M21-S03, M21-S05). Each person only ever sees their own. */
export const realNotices: NoticesService = {
  async feed(actor) {
    need(actor, 'admin.access');
    await ensureAddress(actor);
    return listAdminNotices(await context(), catalogActor(actor));
  },
  async markAllRead(actor) {
    need(actor, 'admin.access');
    await markAdminNoticesRead(await context(), catalogActor(actor));
  },
  async prefs(actor) {
    need(actor, 'admin.access');
    await ensureAddress(actor);
    return getNotificationPrefs(await context(), catalogActor(actor));
  },
  async setPrefs(actor, patch) {
    need(actor, 'admin.access');
    const clean = {
      ...(typeof patch.failures === 'boolean' ? { failures: patch.failures } : {}),
      ...(typeof patch.captionsReady === 'boolean' ? { captionsReady: patch.captionsReady } : {}),
      ...(typeof patch.dailySummary === 'boolean' ? { dailySummary: patch.dailySummary } : {}),
      ...(typeof patch.emailFrequency === 'string' ? { emailFrequency: patch.emailFrequency } : {}),
    };
    const result = await asResult(async () => ({
      ok: true as const,
      prefs: await setNotificationPrefs(await context(), catalogActor(actor), clean),
    }));
    await ensureAddress(actor);
    return result;
  },
};
