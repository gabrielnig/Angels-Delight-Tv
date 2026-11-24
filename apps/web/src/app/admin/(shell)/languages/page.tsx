import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { LanguagesScreen } from '@/components/admin/languages/LanguagesScreen';
import { PageHeader } from '@/components/admin/PageHeader';
import { ErrorState } from '@/components/admin/states';
import { can } from '@/lib/admin/can';
import { requireActor } from '@/lib/data/admin/session-next';
import { languageOverview } from '@/lib/i18n/admin-queries';

export const metadata: Metadata = { title: 'Languages' };
export const dynamic = 'force-dynamic';

export default async function LanguagesPage() {
  const actor = await requireActor('/admin/languages');
  if (!can(actor.role, 'i18n.edit')) forbidden();
  const crumbs = [{ label: 'Admin', href: '/admin' }, { label: 'Languages' }];
  try {
    const rows = await languageOverview(actor);
    return (
      <>
        <PageHeader
          crumbs={crumbs}
          title="Languages"
          lead="Translate the viewer site. English always works. A language goes live when enough core text is approved. Sample text stays a draft until a native speaker has reviewed it."
        />
        <LanguagesScreen
          rows={rows}
          canPublish={can(actor.role, 'i18n.publish')}
          canOverride={can(actor.role, 'i18n.override')}
        />
      </>
    );
  } catch {
    return (
      <>
        <PageHeader crumbs={crumbs} title="Languages" />
        <ErrorState title="We could not load the languages." help="Nothing was changed. Try again in a moment." />
      </>
    );
  }
}
