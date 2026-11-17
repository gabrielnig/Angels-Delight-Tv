import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { PageHeader } from '@/components/admin/PageHeader';
import { UploadScreen } from '@/components/admin/UploadScreen';
import { can } from '@/lib/admin/can';
import { uploadTransportMode } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import { registerUploadAction } from '../actions';

export const metadata: Metadata = { title: 'Upload videos' };

export default async function UploadPage() {
  const actor = await requireActor('/admin/videos/upload');
  if (!can(actor.role, 'video.upload')) forbidden();
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Videos', href: '/admin/videos' },
          { label: 'Upload' },
        ]}
        title="Upload videos"
        lead="Many at once is fine. A lost connection never loses your progress."
      />
      <UploadScreen
        registerUpload={uploadTransportMode() === 'fixture' ? registerUploadAction : undefined}
      />
    </>
  );
}
