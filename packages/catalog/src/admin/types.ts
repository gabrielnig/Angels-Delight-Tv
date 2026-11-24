import type { Database } from '@ad/db';
import type { PublishState, VideoStatus } from '@ad/shared';

/** Context for the staff side of the catalog. Every call also takes the actor, and runs inside `withAccount`. */
export interface AdminContext {
  db: Database;
  now?: () => Date;
  /** `features.require_approved_captions`. Default true (D-005). */
  requireApprovedCaptions?: boolean;
  /** `features.captions_default_available`. Default true (D-184). */
  captionsDefaultAvailable?: boolean;
}

export type AdminCaptionState = 'none' | 'generating' | 'needs_review' | 'approved' | 'failed';
export type Suitability = 'everyone' | 'kids' | 'older';

/** A video as the admin screens show it. Times are ISO strings. `createdBy` is an account id for the caller to name. */
export interface AdminVideo {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  categoryIds: string[];
  status: VideoStatus;
  publishState: PublishState;
  publishAt: string | null;
  publishedAt: string | null;
  durationSeconds: number;
  sizeBytes: number;
  captionState: AdminCaptionState;
  captionCueCount: number;
  posterId: string | null;
  posterAlt: string | null;
  posterFocus: { x: number; y: number; zoom: number } | null;
  /** State of the recut that applies the saved focus to the generated files. Null when there is none to report. */
  posterRecut?: 'processing' | 'failed' | null;
  suitability: Suitability | null;
  seriesId: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  views: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  failure: { stage: string; reason: string } | null;
  progress: number;
  captionOverrideReason: string | null;
  /** Captions for viewers: null follows the site default, true offers them, false offers none. */
  captionsEnabled: boolean | null;
  captionsOffReason: string | null;
}

export type CommandResult = { ok: true } | { ok: false; error: string };
export const OK: CommandResult = { ok: true };
export const fail = (error: string): CommandResult => ({ ok: false, error });

export const clean = (value: string) => value.trim().replace(/\s+/g, ' ');

/** A url safe slug of at least 3 characters, built from a title. */
export function slugOf(text: string, fallback: string): string {
  const base = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return base.length >= 3 ? base : fallback;
}

/** Raw SQL returns timestamps as text like `2026-06-02 08:00:00+00`. Screens get proper ISO strings. */
export function isoOf(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
