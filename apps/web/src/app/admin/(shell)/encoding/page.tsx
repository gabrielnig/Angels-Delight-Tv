import type { Metadata } from 'next';
import { EncodingQueue } from '@/components/admin/EncodingQueue';
import { PageHeader } from '@/components/admin/PageHeader';
import { NoAccess } from '@/components/admin/states';
import { can } from '@/lib/admin/can';
import { videoService } from '@/lib/data/admin/services';
import { ROLE_LABELS } from '@/lib/data/admin/session';
import { requireActor } from '@/lib/data/admin/session-next';
import { retryEncodeAction } from '../videos/actions';

export const metadata: Metadata = { title: 'Encoding' };

export default async function EncodingPage() {
  const actor = await requireActor('/admin/encoding');
  if (!can(actor.role, 'video.edit')) return <NoAccess pageName="Encoding" roleLabel={ROLE_LABELS[actor.role]} needed="editors and admins" />;
  const jobs = await videoService.encodingQueue(actor);
  return (
    <>
      <PageHeader crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Encoding' }]} title="Encoding queue" lead="Videos being prepared for streaming." />
      <EncodingQueue jobs={jobs} now={Date.now()} retry={retryEncodeAction} />
    </>
  );
}
