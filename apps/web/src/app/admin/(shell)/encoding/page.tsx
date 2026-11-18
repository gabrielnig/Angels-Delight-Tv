import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { EncodingQueue } from '@/components/admin/EncodingQueue';
import { LinkButton } from '@/components/admin/Button';
import { PageHeader } from '@/components/admin/PageHeader';
import { can } from '@/lib/admin/can';
import { videoService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import { retryEncodeAction } from '../videos/actions';

export const metadata: Metadata = { title: 'Encoding' };

export default async function EncodingPage() {
  const actor = await requireActor('/admin/encoding');
  if (!can(actor.role, 'video.edit')) forbidden();
  const jobs = await videoService.encodingQueue(actor);
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Encoding' }]}
        title="Encoding queue"
        lead="Videos being prepared for streaming."
        actions={
          <LinkButton href="/admin/encoding/failed" variant="ghost">
            Failed encodes
          </LinkButton>
        }
      />
      <EncodingQueue jobs={jobs} now={Date.now()} retry={retryEncodeAction} />
    </>
  );
}
