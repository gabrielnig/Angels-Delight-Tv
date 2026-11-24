import type { Metadata } from 'next';
import { forbidden, notFound } from 'next/navigation';
import { WorkspaceScreen } from '@/components/admin/languages/WorkspaceScreen';
import { PageHeader } from '@/components/admin/PageHeader';
import { can } from '@/lib/admin/can';
import { requireActor } from '@/lib/data/admin/session-next';
import { missingReport, workspaceData } from '@/lib/i18n/admin-queries';
import { draftEntries, localeInfo } from '@ad/shared/messages';

export const metadata: Metadata = { title: 'Translate' };
export const dynamic = 'force-dynamic';

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  const info = localeInfo(locale);
  if (!info || info.source) notFound();
  const actor = await requireActor(`/admin/languages/${locale}`);
  if (!can(actor.role, 'i18n.edit')) forbidden();
  const [rows, hits] = await Promise.all([workspaceData(actor, info.code as 'yo'), missingReport(actor, info.code)]);
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Languages', href: '/admin/languages' }, { label: info.englishName }]}
        title={`Translate to ${info.englishName}`}
        lead="Edits are drafts. An Admin approves them, and a language goes live from the Languages screen."
      />
      <WorkspaceScreen
        locale={{ code: info.code, endonym: info.endonym, englishName: info.englishName }}
        rows={rows}
        canApprove={can(actor.role, 'i18n.approve')}
        hasDraft={Object.keys(draftEntries(info.code)).length > 0}
        missingHits={hits}
        initialQuery={typeof q === 'string' ? q : undefined}
      />
    </>
  );
}
