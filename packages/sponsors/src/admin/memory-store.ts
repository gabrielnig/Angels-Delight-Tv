import type { SponsorSlot, SponsorStoredStatus } from '@ad/shared';
import type {
  AuditEntry,
  CreativeRow,
  CreativeWithSlots,
  PrivateRow,
  SponsorAdminStore,
  SponsorRow,
} from './store';

/** In memory store for tests and fixtures. */
export class MemorySponsorStore implements SponsorAdminStore {
  sponsors = new Map<string, SponsorRow>();
  privates = new Map<string, PrivateRow>();
  creatives = new Map<string, CreativeRow>();
  placements = new Map<string, Set<SponsorSlot>>();
  statsFor = new Set<string>();
  audits: AuditEntry[] = [];

  async insertSponsor(row: SponsorRow, priv: PrivateRow) {
    this.sponsors.set(row.id, row);
    this.privates.set(row.id, priv);
  }
  async updateSponsor(id: string, patch: Pick<SponsorRow, 'name' | 'startsAt' | 'endsAt'>, priv: PrivateRow) {
    const row = this.sponsors.get(id);
    if (!row) return false;
    this.sponsors.set(id, { ...row, ...patch });
    this.privates.set(id, priv);
    return true;
  }
  private withSlots(c: CreativeRow): CreativeWithSlots {
    return { ...c, slots: [...(this.placements.get(c.id) ?? [])] };
  }
  async getSponsor(id: string) {
    const sponsor = this.sponsors.get(id);
    if (!sponsor) return null;
    const creatives = [...this.creatives.values()].filter((c) => c.sponsorId === id).map((c) => this.withSlots(c));
    return {
      sponsor,
      priv: this.privates.get(id) ?? { contactNameSealed: null, contactEmailSealed: null, notes: null },
      creatives,
    };
  }
  async listSponsors() {
    return [...this.sponsors.values()].map((sponsor) => ({
      sponsor,
      creativeCount: [...this.creatives.values()].filter((c) => c.sponsorId === sponsor.id).length,
    }));
  }
  async setStatus(id: string, status: SponsorStoredStatus) {
    const row = this.sponsors.get(id);
    if (!row) return false;
    this.sponsors.set(id, { ...row, status });
    return true;
  }
  async hasStats(id: string) {
    return this.statsFor.has(id);
  }
  async deleteSponsor(id: string) {
    this.sponsors.delete(id);
    this.privates.delete(id);
    for (const c of [...this.creatives.values()]) {
      if (c.sponsorId === id) {
        this.creatives.delete(c.id);
        this.placements.delete(c.id);
      }
    }
  }
  async insertCreative(row: CreativeRow, slots: SponsorSlot[]) {
    this.creatives.set(row.id, row);
    this.placements.set(row.id, new Set(slots));
  }
  async updateCreative(id: string, patch: Omit<CreativeRow, 'id' | 'sponsorId'>, slots: SponsorSlot[]) {
    const row = this.creatives.get(id);
    if (!row) return false;
    this.creatives.set(id, { ...row, ...patch });
    this.placements.set(id, new Set(slots));
    return true;
  }
  async getCreative(id: string) {
    const c = this.creatives.get(id);
    return c ? this.withSlots(c) : null;
  }
  async deleteCreative(id: string) {
    this.creatives.delete(id);
    this.placements.delete(id);
  }
  async audit(entry: AuditEntry) {
    this.audits.push(entry);
  }
}
