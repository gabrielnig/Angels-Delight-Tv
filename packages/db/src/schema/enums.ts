import {
  ACCOUNT_ROLES,
  ACCOUNT_STATUSES,
  ASSET_PURPOSES,
  ASSET_STATUSES,
  CAPTION_SOURCES,
  CAPTION_STATUSES,
  JOB_STATUSES,
  PUBLISH_STATES,
  RENDITION_STATUSES,
  ROW_KINDS,
  THEME_STATUSES,
  TOKEN_PURPOSES,
  UPLOAD_KINDS,
  UPLOAD_STATUSES,
  VIDEO_KINDS,
  VIDEO_STATUSES,
} from '@ad/shared';
import { pgEnum } from 'drizzle-orm/pg-core';

export const accountRole = pgEnum('account_role', ACCOUNT_ROLES);
export const accountStatus = pgEnum('account_status', ACCOUNT_STATUSES);
export const videoKind = pgEnum('video_kind', VIDEO_KINDS);
export const videoStatus = pgEnum('video_status', VIDEO_STATUSES);
export const publishState = pgEnum('publish_state', PUBLISH_STATES);
export const renditionStatus = pgEnum('rendition_status', RENDITION_STATUSES);
export const captionSource = pgEnum('caption_source', CAPTION_SOURCES);
export const captionStatus = pgEnum('caption_status', CAPTION_STATUSES);
export const uploadKind = pgEnum('upload_kind', UPLOAD_KINDS);
export const uploadStatus = pgEnum('upload_status', UPLOAD_STATUSES);
export const jobStatus = pgEnum('job_status', JOB_STATUSES);
export const rowKind = pgEnum('row_kind', ROW_KINDS);
export const tokenPurpose = pgEnum('token_purpose', TOKEN_PURPOSES);
export const themeStatus = pgEnum('theme_status', THEME_STATUSES);
export const assetPurpose = pgEnum('asset_purpose', ASSET_PURPOSES);
export const assetStatus = pgEnum('asset_status', ASSET_STATUSES);
