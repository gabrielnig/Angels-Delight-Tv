/** Enum values from docs/DATA-MODEL.md section 3. The database schema and the app both build on these. */
export const ACCOUNT_ROLES = ['viewer', 'editor', 'admin', 'super_admin'] as const;
export const ACCOUNT_STATUSES = ['active', 'suspended', 'pending_deletion', 'deleted'] as const;
export const VIDEO_KINDS = ['standalone', 'episode'] as const;
export const VIDEO_STATUSES = [
  'uploading',
  'uploaded',
  'validating',
  'encoding',
  'ready',
  'failed',
] as const;
export const PUBLISH_STATES = ['draft', 'scheduled', 'published', 'unpublished'] as const;
export const RENDITION_STATUSES = ['pending', 'encoding', 'ready', 'failed'] as const;
export const CAPTION_SOURCES = ['whisper', 'aligned', 'manual', 'translation'] as const;
export const CAPTION_STATUSES = [
  'draft',
  'in_review',
  'approved',
  'rejected',
  'superseded',
] as const;
export const UPLOAD_KINDS = ['video', 'image', 'caption'] as const;
export const UPLOAD_STATUSES = [
  'initiated',
  'uploading',
  'completing',
  'completed',
  'aborted',
  'expired',
  'failed',
] as const;
export const JOB_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'failed_permanent',
  'cancelled',
] as const;
export const ROW_KINDS = [
  'hero',
  'curated',
  'category',
  'recently_added',
  'continue_watching',
  'my_list',
  'popular',
] as const;
export const TOKEN_PURPOSES = ['verify_email', 'reset_password', 'change_email'] as const;
export const THEME_STATUSES = ['draft', 'published', 'archived'] as const;
export const ASSET_PURPOSES = ['logo', 'favicon', 'thumbnail', 'hero', 'series_art'] as const;
export const ASSET_STATUSES = ['processing', 'ready', 'failed'] as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[number];
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type VideoKind = (typeof VIDEO_KINDS)[number];
export type VideoStatus = (typeof VIDEO_STATUSES)[number];
export type PublishState = (typeof PUBLISH_STATES)[number];
export type RenditionStatus = (typeof RENDITION_STATUSES)[number];
export type CaptionSource = (typeof CAPTION_SOURCES)[number];
export type CaptionStatus = (typeof CAPTION_STATUSES)[number];
export type UploadKind = (typeof UPLOAD_KINDS)[number];
export type UploadStatus = (typeof UPLOAD_STATUSES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type RowKind = (typeof ROW_KINDS)[number];
export type TokenPurpose = (typeof TOKEN_PURPOSES)[number];
export type ThemeStatus = (typeof THEME_STATUSES)[number];
export type AssetPurpose = (typeof ASSET_PURPOSES)[number];
export type AssetStatus = (typeof ASSET_STATUSES)[number];

/** Request scoped identity passed to withAccount and policy functions. */
export interface Actor {
  accountId: string;
  role: AccountRole;
}
