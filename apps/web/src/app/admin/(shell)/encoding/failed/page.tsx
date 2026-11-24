import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { FailedEncodes } from '@/components/admin/FailedEncodes';
import { PageHeader } from '@/components/admin/PageHeader';
import { can } from '@/lib/admin/can';
import { videoService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import {
  bulkCleanupFailedAction,
  bulkRetryEncodesAction,
  cleanupAllFailedAction,
  cleanupFailedAction,
  retryEncodeAction,
} from '../../videos/actions';

export const metadata: Metadata = { title: 'Failed encodes' };

export default async function FailedEncodesPage() {
  const actor = await requireActor('/admin/encoding/failed');
  if (!can(actor.role, 'video.edit')) forbidden();
  const rows = await videoService.failedEncodes(actor);
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Encoding', href: '/admin/encoding' },
          { label: 'Failed' },
        ]}
        title="Failed encodes"
        lead="Retry a video, or clear the files a failed run left behind."
      />
      <FailedEncodes
        rows={rows}
        role={actor.role}
        now={Date.now()}
        retry={retryEncodeAction}
        cleanup={cleanupFailedAction}
        cleanupAll={cleanupAllFailedAction}
        retryMany={bulkRetryEncodesAction}
        cleanupMany={bulkCleanupFailedAction}
      />
    </>
  );
}
