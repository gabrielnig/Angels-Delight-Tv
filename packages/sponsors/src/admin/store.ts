import type { SponsorSlot, SponsorStoredStatus } from '@ad/shared';

export interface SponsorRow {
  id: string;
  name: string;
  status: SponsorStoredStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  createdBy: string | null;
}

export interface PrivateRow {
  contactNameSealed: string | null;
  contactEmailSealed: string | null;
  notes: string | null;
}

export interface CreativeRow {
  id: string;
  sponsorId: string;
  headline: string;
  body: string | null;
  ctaLabel: string;
  destinationUrl: string;
  imageSquareAssetId: string | null;
  imageWideAssetId: string | null;
  altText: string | null;
  weight: number;
  active: boolean;
}

export type CreativeWithSlots = CreativeRow & { slots: SponsorSlot[] };

export interface AuditEntry {
  action: string;
  actorAccountId: string;
  actorRole: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export interface SponsorAdminStore {
  insertSponsor(row: SponsorRow, priv: PrivateRow): Promise<void>;
  updateSponsor(id: string, patch: Pick<SponsorRow, 'name' | 'startsAt' | 'endsAt'>, priv: PrivateRow): Promise<boolean>;
  getSponsor(id: string): Promise<{ sponsor: SponsorRow; priv: PrivateRow; creatives: CreativeWithSlots[] } | null>;
  listSponsors(): Promise<{ sponsor: SponsorRow; creativeCount: number }[]>;
  setStatus(id: string, status: SponsorStoredStatus): Promise<boolean>;
  hasStats(id: string): Promise<boolean>;
  deleteSponsor(id: string): Promise<void>;
  insertCreative(row: CreativeRow, slots: SponsorSlot[]): Promise<void>;
  updateCreative(id: string, patch: Omit<CreativeRow, 'id' | 'sponsorId'>, slots: SponsorSlot[]): Promise<boolean>;
  getCreative(id: string): Promise<CreativeWithSlots | null>;
  deleteCreative(id: string): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
}
