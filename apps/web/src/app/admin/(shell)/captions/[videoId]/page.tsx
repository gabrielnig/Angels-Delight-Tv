import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NotFound } from '@ad/shared';
import { CaptionBadge } from '@/components/admin/Badge';
import { CaptionReview } from '@/components/admin/CaptionReview';
import { PageHeader } from '@/components/admin/PageHeader';
import { NoAccess } from '@/components/admin/states';
import { can } from '@/lib/admin/can';
import { adminDataMode, captionService } from '@/lib/data/admin/services';
import { ROLE_LABELS } from '@/lib/data/admin/session';
import { requireActor } from '@/lib/data/admin/session-next';
import {
  approveCaptionsAction,
  regenerateCaptionsAction,
  saveCuesAction,
  uploadCaptionsAction,
} from '../actions';

export const metadata: Metadata = { title: 'Review captions' };

export default async function CaptionReviewPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  const actor = await requireActor(`/admin/captions/${videoId}`);
  if (!can(actor.role, 'caption.review'))
    return (
      <NoAccess
        pageName="Caption review"
        roleLabel={ROLE_LABELS[actor.role]}
        needed="editors and admins"
      />
    );
  const { track, video } = await captionService.track(actor, videoId).catch((error) => {
    if (error instanceof NotFound) notFound();
    throw error;
  });
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Captions', href: '/admin/captions' },
          { label: video.title },
        ]}
        title={video.title}
        actions={<CaptionBadge state={track?.state ?? 'none'} />}
      />
      <CaptionReview
        key={`${track?.state}-${track?.updatedAt}`}
        video={video}
        track={track}
        role={actor.role}
        preview={adminDataMode() === 'real'}
        actions={{
          save: saveCuesAction.bind(null, videoId),
          approve: approveCaptionsAction.bind(null, videoId),
          regenerate: regenerateCaptionsAction.bind(null, videoId),
          upload: uploadCaptionsAction.bind(null, videoId),
        }}
      />
    </>
  );
}
