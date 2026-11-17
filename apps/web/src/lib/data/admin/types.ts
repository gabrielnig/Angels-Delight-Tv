import type { AccountRole, PublishState, VideoStatus } from '@ad/shared';
import type { Cue } from '@/lib/admin/cues';

/** Request scoped identity every service call takes (docs/SECURITY.md section 5). */
export interface AdminActor {
  accountId: string;
  role: AccountRole;
  name: string;
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
  role: 'editor' | 'admin';
  twoFactor: boolean;
  lastSignInAt: string | null;
}

export interface InviteRecord {
  id: string;
  email: string;
  role: 'editor' | 'admin';
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
