import type { PageSlug } from '@ad/theme/client';
import type { AdminActor } from './types';

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

export type InviteCodeStatus = 'active' | 'used_up' | 'expired' | 'revoked';

/** One sign up invite code as the Invite codes tab shows it. The code itself is only returned when it is created. */
export interface InviteCodeDto {
  id: string;
  label: string;
  /** Last two characters of the code, so codes can be told apart after the code is hidden. */
  hint: string;
  uses: number;
  maxUses: number;
  expiresAt: string | null;
  createdAt: string;
  status: InviteCodeStatus;
}

export interface InviteCodeInput {
  label: string;
  maxUses: number;
  /** An ISO time, or null for a code that does not expire. */
  expiresAt: string | null;
}

export type InviteCodeResult =
  | { ok: true; invites: InviteCodeDto[]; code?: string }
  | { ok: false; error: string };

export interface InviteCodesService {
  list(actor: AdminActor): Promise<InviteCodeDto[]>;
  create(actor: AdminActor, input: InviteCodeInput): Promise<InviteCodeResult>;
  revoke(actor: AdminActor, id: string): Promise<InviteCodeResult>;
}
