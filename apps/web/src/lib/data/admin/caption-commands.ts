import type { AccountRole } from '@ad/shared';
import { can } from '@/lib/admin/can';
import type { Cue } from '@/lib/admin/cues';
import { changesSinceApproval, validateCues } from '@/lib/admin/cues';
import type { BulkIssue } from './bulk';
import type { AdminStore } from './store';
import type { CaptionState, CaptionTrack, VideoRecord } from './types';

const SENTENCES = [
  'Never share your password with anyone.',
  'Not even a friend, and not even a teacher.',
  'If someone asks, say no and tell an adult.',
  'A strong password uses words you can remember.',
  'Use numbers and symbols to make it stronger.',
  'Change it if you think someone has seen it.',
  'Plants make their own food from sunlight.',
  'The green parts of a leaf catch the light.',
  'Water comes up from the roots.',
  'Air goes in through tiny holes in the leaf.',
];

const hash = (text: string) =>
  [...text].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7);

/** Deterministic placeholder cues so every state can be shown before the worker produces real ones. */
export function sampleCues(seed: string, count: number, durationSeconds: number): Cue[] {
  const total = durationSeconds * 1000;
  const slot = Math.floor(total / Math.max(1, count));
  const offset = hash(seed);
  return Array.from({ length: count }, (_, index) => {
    const start = index * slot;
    return {
      id: `cue_${seed}_${index + 1}`,
      start,
      end: start + Math.max(500, slot - 200),
      text: SENTENCES[(offset + index) % SENTENCES.length]!,
    };
  });
}

const APPROVER = 'Tunde Bakare';

/** Creates the track for a video on first look, from the caption state the video already has. */
export function ensureTrack(
  store: AdminStore,
  video: VideoRecord,
  now: number,
): CaptionTrack | null {
  const existing = store.captions[video.id];
  if (existing) return existing;
  if (video.captionState === 'none') return null;
  const stamp = new Date(now - 86_400_000).toISOString();
  const count = video.captionCueCount || 40;
  const cues =
    video.captionState === 'generating'
      ? []
      : sampleCues(video.id, count, video.durationSeconds || 240);
  const base: CaptionTrack = {
    videoId: video.id,
    language: 'en',
    state: video.captionState,
    cues,
    source: 'whisper',
    approvedBy: null,
    approvedAt: null,
    approvedCues: null,
    updatedBy: 'Automatic',
    updatedAt: stamp,
    failure: null,
    progress: null,
  };
  if (video.captionState === 'approved') {
    base.approvedBy = APPROVER;
    base.approvedAt = stamp;
    base.approvedCues = cues.map((c) => ({ ...c }));
    base.updatedBy = APPROVER;
  }
  if (video.captionState === 'generating') base.progress = { step: 3, of: 5, minutesLeft: 4 };
  if (video.captionState === 'failed') base.failure = 'The audio was too quiet to read.';
  if (video.captionState === 'needs_review') {
    // Seed the warnings the review screen is built to show: an overlap, a long line and an empty cue.
    if (cues.length > 6) {
      cues[2] = { ...cues[2]!, start: cues[1]!.end - 300 };
      cues[3] = {
        ...cues[3]!,
        text: `${cues[3]!.text} ${cues[4]!.text} and nobody could guess it from your life`,
      };
      cues[5] = { ...cues[5]!, text: '' };
    }
  }
  store.captions[video.id] = base;
  return base;
}

export type SaveResult = { ok: true; changesSinceApproval: number } | { ok: false; error: string };
export type CaptionResult = { ok: true } | { ok: false; error: string };

const DENIED = 'You do not have permission to edit captions.';

/** Why a list of cues cannot be saved, in plain words, or null when it can. */
export function cueListProblem(cues: Cue[]): string | null {
  if (cues.length === 0 || cues.length > 5000) return 'Captions need between 1 and 5000 cues.';
  for (const cue of cues) {
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0)
      return 'A cue has a time that is not valid.';
    if (cue.text.length > 500) return 'A cue is over 500 characters. Split it into two.';
  }
  return null;
}

export function saveCues(
  store: AdminStore,
  video: VideoRecord,
  cues: Cue[],
  role: AccountRole,
  by: string,
  now: number,
): SaveResult {
  if (!can(role, 'caption.review')) return { ok: false, error: DENIED };
  const track = ensureTrack(store, video, now);
  if (!track) return { ok: false, error: 'This video has no captions yet.' };
  if (track.state === 'generating') return { ok: false, error: 'Captions are still being made.' };
  const problem = cueListProblem(cues);
  if (problem) return { ok: false, error: problem };
  track.cues = cues.map(({ id, start, end, text }) => ({ id, start, end, text }));
  track.updatedBy = by;
  track.updatedAt = new Date(now).toISOString();
  return {
    ok: true,
    changesSinceApproval: track.approvedCues
      ? changesSinceApproval(track.approvedCues, track.cues)
      : 0,
  };
}

export function approveTrack(
  store: AdminStore,
  video: VideoRecord,
  role: AccountRole,
  by: string,
  now: number,
): CaptionResult {
  if (!can(role, 'caption.review')) return { ok: false, error: DENIED };
  const track = ensureTrack(store, video, now);
  if (!track) return { ok: false, error: 'This video has no captions yet.' };
  if (track.state === 'generating') return { ok: false, error: 'Captions are still being made.' };
  if (track.state === 'failed')
    return { ok: false, error: 'Captions could not be made. Upload a file or try again.' };
  const stamp = new Date(now).toISOString();
  track.state = 'approved';
  track.approvedBy = by;
  track.approvedAt = stamp;
  track.approvedCues = track.cues.map((c) => ({ ...c }));
  video.captionState = 'approved';
  video.captionCueCount = track.cues.length;
  video.captionOverrideReason = null;
  video.updatedAt = stamp;
  return { ok: true };
}

export function regenerateTrack(
  store: AdminStore,
  video: VideoRecord,
  role: AccountRole,
  now: number,
): CaptionResult {
  if (!can(role, 'caption.review')) return { ok: false, error: DENIED };
  const track = ensureTrack(store, video, now);
  const stamp = new Date(now).toISOString();
  const next: CaptionTrack = {
    videoId: video.id,
    language: 'en',
    state: 'generating',
    cues: [],
    source: 'whisper',
    approvedBy: null,
    approvedAt: null,
    approvedCues: track?.approvedCues ?? null,
    updatedBy: 'Automatic',
    updatedAt: stamp,
    failure: null,
    progress: { step: 1, of: 5, minutesLeft: 6 },
  };
  store.captions[video.id] = next;
  video.captionState = 'generating';
  video.updatedAt = stamp;
  return { ok: true };
}

export function replaceCues(
  store: AdminStore,
  video: VideoRecord,
  cues: Cue[],
  role: AccountRole,
  by: string,
  now: number,
): CaptionResult {
  if (!can(role, 'caption.review')) return { ok: false, error: DENIED };
  const stamp = new Date(now).toISOString();
  store.captions[video.id] = {
    videoId: video.id,
    language: 'en',
    state: 'needs_review',
    cues,
    source: 'manual',
    approvedBy: null,
    approvedAt: null,
    approvedCues: null,
    updatedBy: by,
    updatedAt: stamp,
    failure: null,
    progress: null,
  };
  video.captionState = 'needs_review';
  video.captionCueCount = cues.length;
  video.updatedAt = stamp;
  return { ok: true };
}

/** True for automatic captions nobody has opened or edited. Approving these in bulk needs a tick. */
export function isUntouchedAuto(track: Pick<CaptionTrack, 'source' | 'updatedBy'>): boolean {
  return track.source === 'whisper' && track.updatedBy === 'Automatic';
}

export interface BulkCaptionRow {
  videoId: string;
  state: CaptionState;
  /** Number of cues with a warning. Zero when it is not known up front. */
  warnings: number;
  untouchedAuto: boolean;
}

const SKIP_REASON: Record<Exclude<CaptionState, 'needs_review'>, string> = {
  failed: 'Captions failed. Retry or upload a file.',
  generating: 'Still being made.',
  none: 'No captions yet.',
  approved: 'Already approved.',
};
export const WARNINGS_REASON = 'Has warnings. Open it to review.';

/** Splits a selection into rows that can be approved and rows that are skipped with a reason (L3-D09). */
export function planBulkApprove(rows: readonly BulkCaptionRow[]) {
  const eligible: string[] = [];
  const untouchedAuto: string[] = [];
  const skipped: BulkIssue[] = [];
  for (const row of rows) {
    if (row.state !== 'needs_review') skipped.push({ id: row.videoId, reason: SKIP_REASON[row.state] });
    else if (row.warnings > 0) skipped.push({ id: row.videoId, reason: WARNINGS_REASON });
    else {
      eligible.push(row.videoId);
      if (row.untouchedAuto) untouchedAuto.push(row.videoId);
    }
  }
  return { eligible, untouchedAuto, skipped };
}

export const BULK_DENIED = 'Only an admin can approve captions in bulk.';

/** Fixture bulk approve. Same rules as the real service: admin only, warnings are skipped, never forced. */
export function approveMany(
  store: AdminStore,
  ids: readonly string[],
  role: AccountRole,
  by: string,
  now: number,
): { succeeded: string[]; failed: BulkIssue[]; skipped: BulkIssue[] } {
  const out = { succeeded: [] as string[], failed: [] as BulkIssue[], skipped: [] as BulkIssue[] };
  if (!can(role, 'caption.approve_bulk')) {
    out.failed = ids.map((id) => ({ id, reason: BULK_DENIED, retryable: false }));
    return out;
  }
  for (const id of ids) {
    const video = store.videos.find((v) => v.id === id && v.deletedAt === null);
    if (!video) {
      out.failed.push({ id, reason: 'This video no longer exists.', retryable: false });
      continue;
    }
    const track = ensureTrack(store, video, now);
    const plan = planBulkApprove([
      {
        videoId: id,
        state: track?.state ?? 'none',
        warnings: track ? validateCues(track.cues).size : 0,
        untouchedAuto: track ? isUntouchedAuto(track) : false,
      },
    ]);
    if (plan.skipped[0]) {
      out.skipped.push(plan.skipped[0]);
      continue;
    }
    const result = approveTrack(store, video, role, by, now);
    if (result.ok) out.succeeded.push(id);
    else out.failed.push({ id, reason: result.error, retryable: false });
  }
  return out;
}
