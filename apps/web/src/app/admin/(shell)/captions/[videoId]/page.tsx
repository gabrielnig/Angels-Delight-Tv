import type { Metadata } from 'next';
import { notFound, forbidden } from 'next/navigation';
import { NotFound } from '@ad/shared';
import { CaptionBadge } from '@/components/admin/Badge';
import { CaptionReview } from '@/components/admin/CaptionReview';
import { PageHeader } from '@/components/admin/PageHeader';
import { can } from '@/lib/admin/can';
import { adminDataMode, captionService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import { LanguageTabs, type LanguageTab } from '@/components/admin/captions/LanguageTabs';
import { TranslationTools } from '@/components/admin/captions/TranslationTools';
import { themeRuntime } from '@/lib/data/admin/theme-runtime';
import { normalizeLocale } from '@ad/shared';
import {
  approveCaptionsAction,
  alignScriptAction,
  estimateTranslationAction,
  previewScriptAction,
  publishLanguageAction,
  regenerateCaptionsAction,
  saveCuesAction,
  translateCaptionsAction,
  uploadCaptionsAction,
} from '../actions';

export const metadata: Metadata = { title: 'Review captions' };

export default async function CaptionReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { videoId } = await params;
  const { lang } = await searchParams;
  const requested = normalizeLocale(lang) ?? undefined;
  const actor = await requireActor(`/admin/captions/${videoId}`);
  if (!can(actor.role, 'caption.review')) forbidden();
  const { track, video } = await captionService.track(actor, videoId, requested).catch((error) => {
    if (error instanceof NotFound) notFound();
    throw error;
  });
  const row = (await captionService.list(actor)).find((r) => r.videoId === videoId);
  const spoken = row?.spokenLanguage ?? 'en';
  const current = requested && requested !== spoken ? requested : spoken;
  const translations = row?.translations ?? [];
  const tabs: LanguageTab[] = [
    { language: spoken, state: row?.state === 'approved' ? 'approved' : 'needs_review' },
    ...translations.map((t) => ({ language: t.language, state: t.state })),
  ];
  const enabled = ((await (await themeRuntime()).settings.get('content.languages')) as string[]) ?? ['en'];
  const available = enabled.filter((code) => code !== spoken && !translations.some((t) => t.language === code));
  const language = current === spoken ? undefined : current;
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
      <LanguageTabs videoId={videoId} tabs={tabs} current={current} spoken={spoken} />
      <TranslationTools
        spoken={spoken}
        current={current}
        available={available}
        canTranslate={can(actor.role, 'caption.translate')}
        canPublish={can(actor.role, 'caption.publish_language')}
        approved={track?.state === 'approved'}
        published={track?.translation?.published ?? false}
        actions={{
          estimate: estimateTranslationAction.bind(null, videoId),
          start: translateCaptionsAction.bind(null, videoId),
          publish: publishLanguageAction.bind(null, videoId),
        }}
      />
      <CaptionReview
        key={`${current}-${track?.state}-${track?.updatedAt}`}
        video={video}
        track={track}
        role={actor.role}
        preview={adminDataMode() === 'real'}
        actions={{
          save: saveCuesAction.bind(null, videoId, language),
          approve: approveCaptionsAction.bind(null, videoId, language),
          regenerate: regenerateCaptionsAction.bind(null, videoId),
          upload: uploadCaptionsAction.bind(null, videoId, language),
          ...(language ? { retranslate: translateCaptionsAction.bind(null, videoId, language) } : {}),
          previewScript: previewScriptAction.bind(null, videoId),
          alignScript: alignScriptAction.bind(null, videoId),
        }}
      />
    </>
  );
}
