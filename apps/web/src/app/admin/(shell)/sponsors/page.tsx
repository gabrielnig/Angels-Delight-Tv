import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { LinkButton } from '@/components/admin/Button';
import { MasterSwitchCard } from '@/components/admin/MasterSwitchCard';
import { PageHeader } from '@/components/admin/PageHeader';
import { SponsorList } from '@/components/admin/SponsorList';
import { can } from '@/lib/admin/can';
import { requireActor } from '@/lib/data/admin/session-next';
import { themeRuntime } from '@/lib/data/admin/theme-runtime';
import { sponsorAdmin } from '@/server/sponsors/admin';
import { setMasterSwitchAction } from './actions';

export const metadata: Metadata = { title: 'Sponsors' };

export default async function SponsorsPage() {
  const actor = await requireActor('/admin/sponsors');
  if (!can(actor.role, 'sponsor.manage')) forbidden();
  const [sponsors, enabled] = await Promise.all([
    sponsorAdmin(actor).list(actor),
    themeRuntime().then((rt) => rt.settings.get('sponsors.enabled')),
  ]);
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Sponsors' }]}
        title="Sponsors"
        lead="Sponsors never show to children. Everything here is off until you turn the switch on."
        actions={<LinkButton href="/admin/sponsors/new" variant="primary" icon="plus">Add sponsor</LinkButton>}
      />
      <div className="adm-stack">
        <MasterSwitchCard
          enabled={Boolean(enabled)}
          canChange={can(actor.role, 'sponsor.activate')}
          setSwitch={setMasterSwitchAction}
        />
        <SponsorList sponsors={sponsors} canManage />
      </div>
    </>
  );
}
