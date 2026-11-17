import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { SiteSettingsView } from '@/components/admin/site/SiteSettingsView';
import { ErrorState } from '@/components/admin/states';
import { allowed, requireActor } from '@/lib/data/admin/session-next';
import { siteSettingsAdmin } from '@/lib/data/admin/site-settings';
import {
  publishPageAction,
  restorePageAction,
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
  return (
    <SiteSettingsView
      initial={result.data}
      actions={{
        update: updateSettingsAction,
        savePage: savePageAction,
        publishPage: publishPageAction,
        restorePage: restorePageAction,
      }}
    />
  );
}
