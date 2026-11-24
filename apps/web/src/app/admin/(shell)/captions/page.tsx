import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { CaptionList } from '@/components/admin/CaptionList';
import { PageHeader } from '@/components/admin/PageHeader';
import { can } from '@/lib/admin/can';
import { captionService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import { bulkApproveCaptionsAction } from './actions';
import type { CaptionState } from '@/lib/data/admin/types';
import { localeInfo } from '@ad/shared';

export const metadata: Metadata = { title: 'Captions' };
const STATES: CaptionState[] = ['needs_review', 'generating', 'failed', 'approved', 'none'];

export default async function CaptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; edited?: string; lang?: string }>;
}) {
  const actor = await requireActor('/admin/captions');
  if (!can(actor.role, 'caption.review')) forbidden();
  const { state, edited, lang } = await searchParams;
  const active = STATES.find((s) => s === state);
  const everything = await captionService.list(actor);
  const languages = [...new Set(everything.flatMap((r) => (r.translations ?? []).map((t) => t.language)))].sort();
  const activeLanguage = languages.find((code) => code === lang);
  // With a language chosen the list is the videos that have that translation, and the state is that translation's.
  const all = activeLanguage
    ? everything.flatMap((r) => {
        const t = r.translations?.find((x) => x.language === activeLanguage);
        return t ? [{ ...r, language: localeInfo(activeLanguage)?.englishName ?? activeLanguage, state: t.state === 'approved' ? ('approved' as const) : ('needs_review' as const) }] : [];
      })
    : everything;
  const byState = active ? all.filter((r) => r.state === active) : all;
  const rows = edited === 'never' ? byState.filter((r) => r.untouchedAuto) : byState;
  const counts: Record<string, number> = { all: all.length };
  for (const row of all) counts[row.state] = (counts[row.state] ?? 0) + 1;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Captions' }]}
        title="Captions"
        lead="Captions must be approved before a video can be published."
      />
      <CaptionList
        rows={rows}
        counts={counts}
        active={active}
        now={Date.now()}
        role={actor.role}
        approve={bulkApproveCaptionsAction}
        neverEdited={edited === 'never'}
        languages={languages}
        activeLanguage={activeLanguage}
      />
    </>
  );
}
