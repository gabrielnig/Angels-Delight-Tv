import type { PageSlug } from '@ad/theme/client';

export interface PageDto {
  slug: PageSlug;
  title: string;
  draftBody: string;
  hasDraft: boolean;
  published: { version: number; body: string; publishedAt: string } | null;
  versions: { version: number; publishedAt: string; publishedBy: string }[];
  isPlaceholder: boolean;
}

export interface ChecklistItemDto {
  id: string;
  label: string;
  done: boolean;
  detail: string;
}

export interface SiteSettingsDto {
  values: Record<string, unknown>;
  checklist: ChecklistItemDto[];
  pages: Record<PageSlug, PageDto>;
  /** False when the actor may not change feature flags and limits (the super admin tier). */
  canChangeFlags: boolean;
}
