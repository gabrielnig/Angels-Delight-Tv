import 'server-only';
import {
  getNotificationPrefs,
  listAdminNotices,
  markAdminNoticesRead,
  setNotificationPrefs,
} from '@ad/catalog';
import type { NoticesService } from '../notices';
import { catalogActor, context, need } from './shared';

/** The bell and the email choices for staff (M21-S03, M21-S05). Each person only ever sees their own. */
export const realNotices: NoticesService = {
  async feed(actor) {
    need(actor, 'admin.access');
    return listAdminNotices(await context(), catalogActor(actor));
  },
  async markAllRead(actor) {
    need(actor, 'admin.access');
    await markAdminNoticesRead(await context(), catalogActor(actor));
  },
  async prefs(actor) {
    need(actor, 'admin.access');
    return getNotificationPrefs(await context(), catalogActor(actor));
  },
  async setPrefs(actor, patch) {
    need(actor, 'admin.access');
    const clean = {
      ...(typeof patch.failures === 'boolean' ? { failures: patch.failures } : {}),
      ...(typeof patch.captionsReady === 'boolean' ? { captionsReady: patch.captionsReady } : {}),
      ...(typeof patch.dailySummary === 'boolean' ? { dailySummary: patch.dailySummary } : {}),
    };
    return {
      ok: true,
      prefs: await setNotificationPrefs(await context(), catalogActor(actor), clean),
    };
  },
};
