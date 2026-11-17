import type { ThemeValues } from '@ad/theme/client';

/** Plain, serialisable shapes that cross from the server actions to the client editor. */

export interface LogoDto {
  assetId: string;
  /** Small data url of the 160 px variant, for the admin preview only. Viewers load the media URL. */
  dataUrl: string;
  altText: string | null;
  width: number;
  height: number;
  bytes: number;
}

export interface ThemeEditorDto {
  theme: ThemeValues;
  logo: LogoDto | null;
  platformName: string;
  hasDraft: boolean;
  draftVersion: number | null;
  draftSavedAt: string | null;
  publishedVersion: number | null;
  publishedAt: string | null;
}

export interface HistoryRowDto {
  id: string;
  version: number;
  status: 'published' | 'draft';
  isCurrent: boolean;
  isDraftInProgress: boolean;
  at: string;
  by: string;
  fontLabel: string;
  typeScale: number;
  swatches: string[];
  primary: string;
  contrast: number;
  contrastLevel: 'pass' | 'warn' | 'block';
}

export interface HistoryDto {
  items: HistoryRowDto[];
  total: number;
  nextBefore: number | null;
}

export interface VersionDetailDto extends HistoryRowDto {
  theme: ThemeValues;
}

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | {
      ok: false;
      message: string;
      fields?: Record<string, string[]>;
      /** Set when publishing needs the admin to confirm contrast warnings. */
      warnings?: { id: string; message: string }[];
    };
