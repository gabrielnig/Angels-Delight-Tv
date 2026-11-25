import {
  MemorySponsorStore,
  type AuditEntry,
  type CreativeRow,
  type PrivateRow,
  type ReportStore,
  type SponsorRow,
  type StatRow,
} from '@ad/sponsors';
import type { AdminDonation, DonationAdminStore, DonationFilter, DonationAuditEntry } from '@ad/payments';
import type { SponsorSlot } from '@ad/shared';
import { DEMO_DATASET, DEMO_NOW_ISO } from './dataset';
import { kbDemoAllowed } from './reset';

/**
 * Sponsors and donations for the help recordings. The real screens read Postgres, which the fixture stack does not
 * have, so with `KB_DEMO=on` on a development fixture build they read these in memory copies of the demo dataset
 * instead. Everything is clearly fake and marked test. The reset route drops this state so each episode starts clean.
 */

export const KB_MONEY_KEY = 'ad.kb.money';

/** True only on the isolated demo stack. Production and real data never take this path. */
export const kbDemoMoney = (env: Record<string, string | undefined> = process.env): boolean => kbDemoAllowed(env);

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const lagosStart = (day: string) => new Date(`${day}T00:00:00+01:00`);
const lagosEnd = (day: string) => new Date(`${day}T23:59:59+01:00`);

export interface DemoMoney {
  sponsors: MemorySponsorStore;
  donations: DemoDonationStore;
  stats: StatRow[];
  reportAudits: AuditEntry[];
}

export class DemoDonationStore implements DonationAdminStore {
  rows: AdminDonation[] = [];
  audits: DonationAuditEntry[] = [];

  private day(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(d);
  }
  async list(filter: DonationFilter): Promise<AdminDonation[]> {
    const out = this.rows.filter((d) => {
      if (filter.status && d.status !== filter.status) return false;
      if (filter.kind && d.kind !== filter.kind) return false;
      const day = this.day(d.createdAt);
      if (filter.from && day < filter.from) return false;
      if (filter.to && day > filter.to) return false;
      return true;
    });
    return out.slice(0, filter.limit ?? 200);
  }
  async get(id: string) {
    return this.rows.find((d) => d.id === id) ?? null;
  }
  async resolve(id: string, accept: boolean, note: string) {
    const row = this.rows.find((d) => d.id === id);
    if (!row || row.status !== 'needs_review') return false;
    row.status = accept ? 'succeeded' : 'failed';
    row.reviewReason = note;
    return true;
  }
  async audit(entry: DonationAuditEntry) {
    this.audits.push(entry);
  }
}

function seedSponsors(store: MemorySponsorStore): StatRow[] {
  const dates: Record<string, [string | null, string | null]> = {
    spn_demo_1: ['2026-03-01', '2026-04-30'],
    spn_demo_2: [null, null],
    spn_demo_3: ['2026-02-15', '2026-05-31'],
    spn_demo_4: ['2026-01-05', '2026-02-20'],
  };
  for (const s of DEMO_DATASET.sponsors) {
    const [from, to] = dates[s.id] ?? [null, null];
    const row: SponsorRow = {
      id: s.id,
      name: s.name,
      status: s.status,
      startsAt: from ? lagosStart(from) : null,
      endsAt: to ? lagosEnd(to) : null,
      createdBy: null,
    };
    const priv: PrivateRow = {
      contactNameSealed: b64('Demo Contact'),
      contactEmailSealed: b64(s.contactEmail),
      notes: s.note,
    };
    void store.insertSponsor(row, priv);
  }
  const creative = (
    id: string,
    sponsorId: string,
    headline: string,
    body: string,
    slots: SponsorSlot[],
  ): void => {
    const row: CreativeRow = {
      id,
      sponsorId,
      headline,
      body,
      ctaLabel: 'Learn more',
      destinationUrl: 'https://example.com/demo-sponsor',
      imageSquareAssetId: null,
      imageWideAssetId: null,
      altText: null,
      weight: 1,
      active: true,
    };
    void store.insertCreative(row, slots);
  };
  creative('crv_demo_1', 'spn_demo_1', 'Demo thank you message (test)', 'A test message for the help videos.', ['home_banner', 'title_card']);
  creative('crv_demo_2', 'spn_demo_2', 'Demo Bakery welcome (test)', 'A test message, not shown yet.', []);
  creative('crv_demo_3', 'spn_demo_3', 'Demo Books reading tip (test)', 'A test message, paused.', ['player_after']);
  store.statsFor.add('spn_demo_1');
  store.statsFor.add('spn_demo_3');

  const rows: StatRow[] = [];
  const days = ['2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09'];
  days.forEach((day, i) => {
    rows.push({ day, creativeId: 'crv_demo_1', slot: 'home_banner', impressions: 100 + i * 20, clicks: 4 + i, reach: 60 + i * 10 });
    rows.push({ day, creativeId: 'crv_demo_1', slot: 'title_card', impressions: 40 + i * 10, clicks: 2 + (i % 3), reach: 30 + i * 5 });
  });
  return rows;
}

function seedDonations(store: DemoDonationStore): void {
  const base = Date.parse(DEMO_NOW_ISO);
  const map = { paid: 'succeeded', pending: 'pending', failed: 'failed', needs_review: 'needs_review' } as const;
  store.rows = DEMO_DATASET.donations.map((d, i) => {
    const status = map[d.status];
    const created = new Date(base - (i + 1) * 36 * 3600 * 1000);
    return {
      id: d.id,
      reference: `addondemo${String(i + 1).padStart(2, "0")}`,
      status,
      kind: 'one_time',
      currency: 'NGN',
      amountMinor: d.amountKobo,
      paidAmountMinor: status === 'succeeded' ? d.amountKobo : status === 'needs_review' ? 1_000_000 : null,
      siteMode: 'test',
      anonymous: i === 2,
      donorName: d.donor,
      donorEmail: d.email,
      channel: 'card',
      reviewReason: status === 'needs_review' ? 'The amount paid is less than the amount asked for.' : null,
      receiptSentAt: status === 'succeeded' ? created : null,
      createdAt: created,
      paidAt: status === 'succeeded' ? created : null,
    } satisfies AdminDonation;
  });
}

/** The demo state, built on first use and dropped by the reset route. */
export function demoMoney(): DemoMoney {
  const holder = globalThis as unknown as Record<symbol, DemoMoney | undefined>;
  const slot = Symbol.for(KB_MONEY_KEY);
  const held = holder[slot];
  if (held) return held;
  const sponsors = new MemorySponsorStore();
  const stats = seedSponsors(sponsors);
  const donations = new DemoDonationStore();
  seedDonations(donations);
  return (holder[slot] = { sponsors, donations, stats, reportAudits: [] });
}

export function demoReportStore(): ReportStore {
  const m = demoMoney();
  return {
    async sponsor(id) {
      const found = await m.sponsors.getSponsor(id);
      return found ? { id, name: found.sponsor.name } : null;
    },
    async creatives(sponsorId) {
      const found = await m.sponsors.getSponsor(sponsorId);
      return (found?.creatives ?? []).map((c) => ({ id: c.id, headline: c.headline }));
    },
    async stats(sponsorId, fromDay, toDay) {
      const found = await m.sponsors.getSponsor(sponsorId);
      const ids = new Set((found?.creatives ?? []).map((c) => c.id));
      return m.stats.filter((r) => ids.has(r.creativeId) && r.day >= fromDay && r.day <= toDay);
    },
    async audit(entry) {
      m.reportAudits.push(entry);
    },
  };
}

