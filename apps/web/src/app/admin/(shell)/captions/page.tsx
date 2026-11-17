import type { Metadata } from 'next';
import { CaptionList } from '@/components/admin/CaptionList';
import { PageHeader } from '@/components/admin/PageHeader';
import { NoAccess } from '@/components/admin/states';
import { can } from '@/lib/admin/can';
import { captionService } from '@/lib/data/admin/services';
import { ROLE_LABELS } from '@/lib/data/admin/session';
import { requireActor } from '@/lib/data/admin/session-next';
import type { CaptionState } from '@/lib/data/admin/types';

export const metadata: Metadata = { title: 'Captions' };
const STATES: CaptionState[] = ['needs_review', 'generating', 'failed', 'approved', 'none'];

export default async function CaptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const actor = await requireActor('/admin/captions');
  if (!can(actor.role, 'caption.review'))
    return (
      <NoAccess
        pageName="Captions"
        roleLabel={ROLE_LABELS[actor.role]}
        needed="editors and admins"
      />
    );
  const { state } = await searchParams;
  const active = STATES.find((s) => s === state);
  const all = await captionService.list(actor);
  const rows = active ? all.filter((r) => r.state === active) : all;
  const counts: Record<string, number> = { all: all.length };
  for (const row of all) counts[row.state] = (counts[row.state] ?? 0) + 1;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Captions' }]}
        title="Captions"
        lead="Captions must be approved before a video can be published."
      />
      <CaptionList rows={rows} counts={counts} active={active} now={Date.now()} />
    </>
  );
}
