import type { AccountRole } from '@ad/shared';
import { can } from '@/lib/admin/can';
import type { Suitability, VideoRecord } from './types';
import { canPublish } from './video-rules';
import type { PublishRules } from './video-rules';

export interface VideoPatch {
  title?: string;
  slug?: string;
  description?: string;
  tags?: string[];
  categoryIds?: string[];
  suitability?: Suitability | null;
  seriesId?: string | null;
  episodeNumber?: number | null;
}

export type PatchResult =
  { ok: true; value: VideoPatch } | { ok: false; errors: Record<string, string> };

/** Whitelist and validate an edit. Unknown keys are dropped, never copied across. */
export function validateVideoPatch(input: VideoPatch, validCategoryIds: Set<string>): PatchResult {
  const value: VideoPatch = {};
  const errors: Record<string, string> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) errors.title = 'Add a title.';
    else if (title.length > 120) errors.title = 'Keep the title under 120 characters.';
    else value.title = title;
  }
  if (input.slug !== undefined) {
    const slug = input.slug.trim();
    if (slug.length < 3 || slug.length > 120)
      errors.slug = 'Use 3 to 120 characters for the address.';
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
      errors.slug = 'Use lower case letters, numbers and single hyphens only for the address.';
    else value.slug = slug;
  }
  if (input.description !== undefined) {
    if (input.description.length > 500)
      errors.description = 'Keep the description under 500 characters.';
    else value.description = input.description.trim();
  }
  if (input.tags !== undefined) {
    const tags = input.tags.map((t) => t.trim()).filter(Boolean);
    if (tags.length > 10) errors.tags = 'Use at most 10 tags.';
    else value.tags = tags;
  }
  if (input.categoryIds !== undefined) {
    if (input.categoryIds.every((id) => validCategoryIds.has(id)))
      value.categoryIds = input.categoryIds;
    else errors.categoryIds = 'Pick categories from the list.';
  }
  if (input.suitability !== undefined) {
    if (input.suitability === null || ['everyone', 'kids', 'older'].includes(input.suitability))
      value.suitability = input.suitability;
    else errors.suitability = 'Pick who this is suitable for.';
  }
  if (input.seriesId !== undefined) value.seriesId = input.seriesId;
  if (input.episodeNumber !== undefined) {
    if (
      input.episodeNumber === null ||
      (Number.isInteger(input.episodeNumber) && input.episodeNumber > 0)
    )
      value.episodeNumber = input.episodeNumber;
    else errors.episodeNumber = 'Use a whole number from 1.';
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

export interface PublishRequest {
  mode: 'now' | 'schedule';
  /** ISO time for schedule mode. */
  at?: string;
  overrideReason?: string;
}

/** `reauth` means the action needs a recent password confirmation first. The screen asks and tries again. */
export type CommandResult = { ok: true } | { ok: false; error: string; reauth?: true };

export function schedulePublish(
  video: VideoRecord,
  request: PublishRequest,
  role: AccountRole,
  rules: PublishRules,
  now: number,
): CommandResult {
  if (!can(role, 'video.publish'))
    return { ok: false, error: 'You do not have permission to publish.' };
  const check = canPublish(video, rules);
  const onlyCaptions =
    check.blockers.length > 0 && check.blockers.every((b) => b.key === 'captions');
  let override: string | null = null;
  if (!check.ok) {
    if (onlyCaptions && request.overrideReason !== undefined && can(role, 'caption.override')) {
      const reason = request.overrideReason.trim();
      if (reason.length < 5)
        return { ok: false, error: 'Say why captions are being skipped, in a few words.' };
      override = reason;
    } else {
      return {
        ok: false,
        error: `Not ready: ${check.blockers.map((b) => b.label).join(', ')} still need attention.`,
      };
    }
  }
  if (request.mode === 'schedule') {
    const at = Date.parse(request.at ?? '');
    if (!Number.isFinite(at) || at <= now)
      return { ok: false, error: 'Pick a time in the future.' };
    video.publishState = 'scheduled';
    video.publishAt = new Date(at).toISOString();
  } else {
    video.publishState = 'published';
    video.publishedAt = video.publishedAt ?? new Date(now).toISOString();
    video.publishAt = null;
  }
  if (override) video.captionOverrideReason = override;
  video.updatedAt = new Date(now).toISOString();
  return { ok: true };
}

const MIN_CAPTIONS_OFF_REASON = 5;

/**
 * Fixture twin of the catalog's `setCaptionsAvailability`: Admin only, Off needs a reason of 5 or more
 * characters (it satisfies the publish gate), back on or default clears the reason (D-184).
 */
export function applyCaptionsAvailability(
  video: VideoRecord,
  role: AccountRole,
  value: boolean | null,
  reason?: string,
): CommandResult {
  if (!can(role, 'caption.availability')) return { ok: false, error: 'Only an Admin can change this.' };
  const trimmed = (reason ?? '').trim();
  if (value === false && trimmed.length < MIN_CAPTIONS_OFF_REASON)
    return {
      ok: false,
      error: `Give a reason of at least ${MIN_CAPTIONS_OFF_REASON} characters for switching captions off.`,
    };
  video.captionsEnabled = value;
  video.captionsOffReason = value === false ? trimmed : null;
  video.updatedAt = new Date().toISOString();
  return { ok: true };
}

const TRASH_DAYS = 30;

export function daysLeftInTrash(deletedAt: string, now: number): number {
  const elapsed = Math.floor((now - Date.parse(deletedAt)) / 86_400_000);
  return Math.max(0, TRASH_DAYS - elapsed);
}

export function restoreVideo(videos: VideoRecord[], id: string, role: AccountRole): CommandResult {
  if (!can(role, 'video.restore'))
    return { ok: false, error: 'You do not have permission to restore videos.' };
  const video = videos.find((v) => v.id === id && v.deletedAt !== null);
  if (!video) return { ok: false, error: 'That video is not in Trash.' };
  video.deletedAt = null;
  return { ok: true };
}

export function purgeVideo(videos: VideoRecord[], id: string, role: AccountRole): CommandResult {
  if (!can(role, 'video.purge')) return { ok: false, error: 'Only an admin can delete forever.' };
  const index = videos.findIndex((v) => v.id === id && v.deletedAt !== null);
  if (index < 0) return { ok: false, error: 'That video is not in Trash.' };
  videos.splice(index, 1);
  return { ok: true };
}

export function retryEncode(video: VideoRecord, now: number): CommandResult {
  if (video.status !== 'failed') return { ok: false, error: 'Only failed videos can be retried.' };
  video.status = 'encoding';
  video.failure = null;
  video.progress = 0;
  video.updatedAt = new Date(now).toISOString();
  return { ok: true };
}
