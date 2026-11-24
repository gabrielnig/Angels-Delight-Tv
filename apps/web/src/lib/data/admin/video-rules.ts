import type { AdminVideoStatus, ChecklistItem, VideoRecord } from './types';

/** A full record with safe defaults. Tests and the fixture seed build on it. */
export function videoStub(overrides: Partial<VideoRecord> = {}): VideoRecord {
  return {
    id: 'video_stub',
    slug: 'video-stub',
    title: '',
    description: '',
    tags: [],
    categoryIds: [],
    status: 'uploaded',
    publishState: 'draft',
    publishAt: null,
    publishedAt: null,
    durationSeconds: 0,
    sizeBytes: 0,
    captionState: 'none',
    captionCueCount: 0,
    posterId: null,
    posterAlt: null,
    posterFocus: null,
    suitability: null,
    seriesId: null,
    seasonNumber: null,
    episodeNumber: null,
    views: 0,
    uploadedBy: 'Unknown',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    failure: null,
    progress: 0,
    captionOverrideReason: null,
    ...overrides,
  };
}

/** Collapses pipeline status, publish state and captions into the badge shown in admin (DESIGN-SYSTEM 11.19). */
export function adminStatusOf(video: VideoRecord): AdminVideoStatus {
  if (video.status === 'failed') return 'failed';
  if (video.status === 'uploading') return 'uploading';
  if (['uploaded', 'validating', 'encoding'].includes(video.status)) return 'processing';
  if (video.publishState === 'published') return 'published';
  if (video.publishState === 'scheduled') return 'scheduled';
  if (!video.title.trim()) return 'draft';
  if (
    video.captionState !== 'approved' &&
    !video.captionOverrideReason &&
    video.captionsEnabled !== false
  ) {
    return video.publishState === 'draft' && video.captionState === 'none' && !video.description
      ? 'draft'
      : 'needs_captions';
  }
  return 'ready';
}

const LEGACY_RANK = { everyone: 0, kids: 0, older: 3 } as const;

/** The rank of a video: its own, or the one a legacy suitability maps to (kids and everyone 0, older 3). */
export function effectiveMaturityRank(
  video: Pick<VideoRecord, 'maturityRank' | 'suitability'>,
): number | null {
  if (video.maturityRank !== undefined && video.maturityRank !== null) return video.maturityRank;
  return video.suitability ? LEGACY_RANK[video.suitability] : null;
}

export interface PublishRules {
  requireApprovedCaptions: boolean;
}

export const MIN_DESCRIPTION_LENGTH = 20;

export function publishChecklist(
  video: VideoRecord,
  rules: PublishRules = { requireApprovedCaptions: true },
): ChecklistItem[] {
  const editHref = `/admin/videos/${video.id}`;
  const uploaded = video.status !== 'uploading';
  const encoded = video.status === 'ready';
  const captionsOk =
    !rules.requireApprovedCaptions ||
    video.captionState === 'approved' ||
    Boolean(video.captionOverrideReason) ||
    video.captionsEnabled === false;
  const detailsOk =
    video.title.trim().length > 0 && video.description.trim().length >= MIN_DESCRIPTION_LENGTH;

  let captionDetail = 'Captions are approved.';
  if (!captionsOk) {
    captionDetail =
      video.captionState === 'needs_review'
        ? 'Captions need review before this can go live.'
        : video.captionState === 'generating'
          ? 'Captions are still being made.'
          : video.captionState === 'failed'
            ? 'Captions could not be made. Upload your own or try again.'
            : 'This video has no captions yet.';
  }

  return [
    {
      key: 'uploaded',
      label: 'Uploaded',
      done: uploaded,
      detail: uploaded ? 'The file is safely uploaded.' : 'The upload has not finished.',
    },
    {
      key: 'encoded',
      label: 'Encoded',
      done: encoded,
      detail: encoded
        ? 'All streaming sizes are ready.'
        : video.status === 'failed'
          ? 'Encoding failed. Retry it from the Encoding queue.'
          : 'Still preparing the video. This takes a few minutes.',
      fixHref: '/admin/encoding',
    },
    {
      key: 'poster',
      label: 'Poster',
      done: video.posterId !== null,
      detail: video.posterId ? 'A poster is chosen.' : 'Choose a poster image.',
      fixHref: `${editHref}/poster`,
    },
    {
      key: 'captions',
      label: 'Captions approved',
      done: captionsOk,
      detail: captionDetail,
      fixHref: `/admin/captions/${video.id}`,
    },
    {
      key: 'details',
      label: 'Details',
      done: detailsOk,
      detail: detailsOk
        ? 'Title and description are filled in.'
        : `Add a title and a description of at least ${MIN_DESCRIPTION_LENGTH} characters.`,
      fixHref: editHref,
    },
    {
      key: 'maturity',
      label: 'Maturity rating',
      done: effectiveMaturityRank(video) !== null,
      detail:
        effectiveMaturityRank(video) !== null
          ? 'A maturity rating is set.'
          : 'Choose a maturity rating.',
      fixHref: editHref,
    },
  ];
}

export function canPublish(
  video: VideoRecord,
  rules: PublishRules = { requireApprovedCaptions: true },
) {
  const blockers = publishChecklist(video, rules).filter((item) => !item.done);
  return { ok: blockers.length === 0, blockers };
}
