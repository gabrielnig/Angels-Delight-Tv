import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NotFound } from '@ad/shared';
import { PageHeader } from '@/components/admin/PageHeader';
import { ShareCardEditor } from '@/components/admin/ShareCardEditor';
import '@/components/admin/site/site.css';
import { can } from '@/lib/admin/can';
import { adminDataMode, collectionService } from '@/lib/data/admin/services';
import { shareAdmin } from '@/lib/data/admin/real/share';
import { requireActor } from '@/lib/data/admin/session-next';
import { getRootTheme } from '@/lib/theme/root';
import { siteOrigin } from '@/server/seo/page-seo';
import { forbidden } from 'next/navigation';
import { saveShareTextAction } from '../../../share/actions';

export const metadata: Metadata = { title: 'Share card' };

export default async function SeriesSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/admin/series/${id}/share`);
  if (!can(actor.role, 'series.manage')) forbidden();
  const detail = await collectionService.seriesDetail(actor, id).catch((error) => {
    if (error instanceof NotFound) notFound();
    throw error;
  });
  const [{ platformName }, initial] = await Promise.all([
    getRootTheme(),
    adminDataMode() === 'real' ? shareAdmin.get(actor, 'series', id) : { title: null, description: null },
  ]);
  const { series } = detail;
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Series', href: '/admin/series' },
          { label: series.title, href: `/admin/series/${id}` },
          { label: 'Share card' },
        ]}
        title="Share card"
        lead={series.title}
      />
      <ShareCardEditor
        title={series.title}
        description={series.description}
        siteName={platformName}
        origin={siteOrigin()}
        imageUrl={null}
        initial={initial}
        save={saveShareTextAction.bind(null, 'series', id)}
      />
    </>
  );
}
