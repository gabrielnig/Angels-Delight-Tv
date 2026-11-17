import type { Metadata } from 'next';
import { LinkButton } from '@/components/admin/Button';
import { PageHeader } from '@/components/admin/PageHeader';
import { VideosList } from '@/components/admin/VideosList';
import { videoService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import { parseVideoQuery } from '@/lib/data/admin/video-queries';
import { bulkVideosAction } from './actions';

export const metadata: Metadata = { title: 'Videos' };

export default async function VideosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor('/admin/videos');
  const query = parseVideoQuery(await searchParams);
  const [page, categories] = await Promise.all([videoService.list(actor, query), videoService.categories(actor)]);
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Videos' }]}
        title="Videos"
        actions={<LinkButton href="/admin/videos/upload" variant="accent" icon="upload">Upload videos</LinkButton>}
      />
      <VideosList page={page} query={query} categories={categories} role={actor.role} bulk={bulkVideosAction} now={Date.now()} />
    </>
  );
}
