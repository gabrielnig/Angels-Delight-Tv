import type { AccountRole, PublishState, VideoStatus } from '@ad/shared';
import type { Cue } from '@/lib/admin/cues';

/** Request scoped identity every service call takes (docs/SECURITY.md section 5). */
export interface AdminActor {
  accountId: string;
  role: AccountRole;
  name: string;
  /** The staff session, so sensitive actions can check a recent password confirmation. Real auth only. */
  sessionId?: string;
}

export type CaptionState = 'none' | 'generating' | 'needs_review' | 'approved' | 'failed';

export type AdminVideoStatus =
  | 'draft'
  | 'uploading'
  | 'processing'
  | 'needs_captions'
  | 'ready'
  | 'scheduled'
  | 'published'
  | 'failed';

export type Suitability = 'everyone' | 'kids' | 'older';

export interface VideoRecord {
  id: string;
  /** The address in /title/<slug>. */
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
  captionState: CaptionState;
  captionCueCount: number;
  posterId: string | null;
  posterAlt: string | null;
  posterFocus: { x: number; y: number; zoom: number } | null;
  posterRecut?: 'processing' | 'failed' | null;
  suitability: Suitability | null;
  seriesId: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  views: number;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  failure: { stage: string; reason: string } | null;
  /** 0 to 100 while encoding. */
  progress: number;
  captionOverrideReason: string | null;
}

export interface CategoryRecord {
  id: string;
  name: string;
  hidden: boolean;
  position: number;
}

export interface SeriesRecord {
  id: string;
  title: string;
  description: string;
  posterId: string | null;
  published: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
  /** Set only by keyset paging, where the previous page cannot be worked out from a number. */
  prevCursor?: string | null;
}

export interface ChecklistItem {
  key: 'uploaded' | 'encoded' | 'poster' | 'captions' | 'details' | 'suitability';
  label: string;
  done: boolean;
  /** Plain words: what is missing, or what is done. */
  detail: string;
  /** Where to fix it. */
  fixHref?: string;
}

export interface TileState<T> {
  state: 'ready' | 'error' | 'forbidden';
  value?: T;
}

export interface CaptionTrack {
  videoId: string;
  language: 'en';
  state: CaptionState;
  cues: Cue[];
  source: 'whisper' | 'manual';
  approvedBy: string | null;
  approvedAt: string | null;
  /** The cues as they were when approved. Viewers keep seeing these until the next approval. */
  approvedCues: Cue[] | null;
  updatedBy: string;
  updatedAt: string;
  failure: string | null;
  progress: { step: number; of: number; minutesLeft: number } | null;
}

export interface UserRecord {
  id: string;
  email: string;
  status: 'active' | 'suspended';
  createdAt: string;
  lastActiveAt: string | null;
  profiles: Array<{ id: string; name: string; kids: boolean }>;
  sessions: number;
  suspendedReason: string | null;
}

export interface StaffRecord {
  id: string;
  name: string;
  email: string;
  role: 'editor' | 'admin' | 'super_admin';
  twoFactor: boolean;
  lastSignInAt: string | null;
}

export interface InviteRecord {
  id: string;
  email: string;
  role: 'editor' | 'admin' | 'super_admin';
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuditRow {
  id: number;
  at: string;
  actorId: string | null;
  actorName: string;
  actorRole: string | null;
  action: string;
  outcome: 'success' | 'failure' | 'denied';
  targetType: string | null;
  targetId: string | null;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  requestId: string | null;
}

export interface SessionRow {
  id: string;
  device: string;
  place: string;
  lastActiveAt: string;
  current: boolean;
}

export interface MyAccount {
  accountId: string;
  name: string;
  email: string;
  twoFactor: boolean;
  recoveryCodesLeft: number;
  passwordChangedAt: string | null;
  sessions: SessionRow[];
}

export interface JobRecord {
  id: string;
  kind: 'encode' | 'captions' | 'poster' | 'email' | 'cleanup';
  state: 'failed' | 'dead';
  subject: string;
  attempts: number;
  maxAttempts: number;
  lastError: string;
  failedAt: string;
}

export interface StorageUsage {
  type: 'video' | 'poster' | 'caption' | 'other';
  bytes: number;
  files: number;
}

/** A failed encode as the cleanup screen shows it. `technical` is only filled for admins. */
export interface FailedEncodeRecord {
  videoId: string;
  title: string;
  failedAt: string;
  code: string | null;
  plain: string;
  technical: string | null;
  stage: string | null;
  attempts: number;
  hasOriginal: boolean;
  originalBytes: number | null;
  canRetry: boolean;
  leftoverFiles: number;
  leftoverBytes: number;
}

export type CleanupResult =
  | { ok: true; videos: number; removedFiles: number; freedBytes: number }
  | { ok: false; error: string };
