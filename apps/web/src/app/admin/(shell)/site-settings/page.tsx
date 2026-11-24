import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { SiteSettingsView } from '@/components/admin/site/SiteSettingsView';
import { ErrorState } from '@/components/admin/states';
import { allowed, requireActor } from '@/lib/data/admin/session-next';
import { inviteCodesAdmin } from '@/lib/data/admin/invite-codes';
import { searchAdmin } from '@/lib/data/admin/search-admin';
import { siteSettingsAdmin } from '@/lib/data/admin/site-settings';
import {
  createInviteCodeAction,
  publishPageAction,
  revokeInviteCodeAction,
  restorePageAction,
  saveSynonymsAction,
  savePageAction,
  updateSettingsAction,
} from './actions';

export const metadata: Metadata = { title: 'Site settings' };
export const dynamic = 'force-dynamic';

export default async function SiteSettingsPage() {
  const actor = await requireActor('/admin/site-settings');
  if (!allowed(actor, 'settings.site')) {
    forbidden();
  }
  const result = await siteSettingsAdmin.load(actor);
  if (!result.ok)
    return (
      <ErrorState
        title="Site settings could not be loaded."
        help="The site keeps running with the saved settings. Try again in a moment."
      />
    );
  const invites = await inviteCodesAdmin.list(actor);
  const searchData = await searchAdmin.load(actor).catch(() => null);
  return (
    <SiteSettingsView
      initial={result.data}
      invites={invites}
      search={
        searchData
          ? { synonyms: searchData.synonyms, misses: searchData.misses }
          : { unavailable: true }
      }
      actions={{
        update: updateSettingsAction,
        savePage: savePageAction,
        publishPage: publishPageAction,
        restorePage: restorePageAction,
        create: createInviteCodeAction,
        revoke: revokeInviteCodeAction,
        saveSynonyms: saveSynonymsAction,
      }}
    />
  );
}
