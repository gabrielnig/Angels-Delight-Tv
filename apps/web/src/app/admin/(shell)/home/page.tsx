import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { HomeCuration } from '@/components/admin/HomeCuration';
import { PageHeader } from '@/components/admin/PageHeader';
import { can } from '@/lib/admin/can';
import { homeService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import {
  backfillPreviewsAction,
  publishHomeAction,
  restoreHomeAction,
  saveHomeDraftAction,
} from './actions';

export const metadata: Metadata = { title: 'Home curation' };

export default async function HomeCurationPage() {
  const actor = await requireActor('/admin/home');
  if (!can(actor.role, 'home.curate')) forbidden();
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
        canBackfill={can(actor.role, 'preview.backfill')}
        actions={{
          saveDraft: saveHomeDraftAction,
          publish: publishHomeAction,
          restore: restoreHomeAction,
          backfillPreviews: backfillPreviewsAction,
        }}
      />
    </>
  );
}
