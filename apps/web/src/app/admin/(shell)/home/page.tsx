import type { Metadata } from 'next';
import { HomeCuration } from '@/components/admin/HomeCuration';
import { PageHeader } from '@/components/admin/PageHeader';
import { NoAccess } from '@/components/admin/states';
import { can } from '@/lib/admin/can';
import { homeService } from '@/lib/data/admin/services';
import { ROLE_LABELS } from '@/lib/data/admin/session';
import { requireActor } from '@/lib/data/admin/session-next';
import { publishHomeAction, restoreHomeAction, saveHomeDraftAction } from './actions';

export const metadata: Metadata = { title: 'Home curation' };

export default async function HomeCurationPage() {
  const actor = await requireActor('/admin/home');
  if (!can(actor.role, 'home.curate'))
    return (
      <NoAccess
        pageName="Home curation"
        roleLabel={ROLE_LABELS[actor.role]}
        needed="editors and admins"
      />
    );
  const data = await homeService.get(actor);
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Home curation' }]}
        title="Home curation"
        lead="Choose what viewers see first. The preview updates as you change things."
      />
      <HomeCuration
        key={`${data.state.publishedAt}-${JSON.stringify(data.state.draft).length}`}
        {...data}
        canCurate
        actions={{
          saveDraft: saveHomeDraftAction,
          publish: publishHomeAction,
          restore: restoreHomeAction,
        }}
      />
    </>
  );
}
