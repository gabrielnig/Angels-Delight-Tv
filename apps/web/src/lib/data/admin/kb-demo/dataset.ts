/**
 * The demo dataset of the knowledge base recording stack (plan section 11.2, D-362). Everything here is clearly fake:
 * names start with Demo or end with "(test)", emails use only the reserved example domains, amounts are round.
 * `apply.ts` lays it over the fixture store, a reset puts it back, and `checkDemoDataset` fails on anything real looking.
 */

/** The pinned clock: 10:00 in Lagos on a fixed day, in the past so no label ever reads as the future. */
export const DEMO_NOW_ISO = '2026-03-10T09:00:00.000Z';

export interface DemoStaff {
  role: 'editor' | 'admin' | 'super_admin';
  name: string;
  email: string;
}

export interface DemoSponsor {
  id: string;
  name: string;
  contactEmail: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  note: string;
}

export interface DemoDonation {
  id: string;
  donor: string;
  email: string;
  /** Whole naira in kobo. Round amounts only. */
  amountKobo: number;
  status: 'paid' | 'pending' | 'failed' | 'needs_review';
  test: boolean;
  note?: string;
}

export interface DemoSeries {
  id: string;
  title: string;
  labels?: { preset: 'season_episode' | 'book_chapter' | 'part_lesson' | 'module_lesson' };
}

export interface DemoDataset {
  staff: DemoStaff[];
  viewers: number;
  categories: string[];
  series: DemoSeries[];
  /** One video per admin status, so every screen has something to point at. */
  videoStatusExamples: Array<{ status: string; videoId: string }>;
  sponsors: DemoSponsor[];
  donations: DemoDonation[];
  emails(this: DemoDataset): string[];
}

const staff: DemoStaff[] = [
  { role: 'super_admin', name: 'Demo Owner', email: 'arkdev@example.test' },
  { role: 'admin', name: 'Demo Admin', email: 'chiamaka@example.test' },
  { role: 'editor', name: 'Demo Editor', email: 'ngozi@example.test' },
];

const sponsors: DemoSponsor[] = [
  {
    id: 'spn_demo_1',
    name: 'Demo Sponsor Ltd (test)',
    contactEmail: 'sponsor@example.com',
    status: 'active',
    note: 'Test sponsor for the help videos.',
  },
  {
    id: 'spn_demo_2',
    name: 'Demo Bakery (test)',
    contactEmail: 'bakery@example.net',
    status: 'draft',
    note: 'Test sponsor, not live.',
  },
  {
    id: 'spn_demo_3',
    name: 'Demo Books (test)',
    contactEmail: 'books@example.org',
    status: 'paused',
    note: 'Test sponsor, paused.',
  },
  {
    id: 'spn_demo_4',
    name: 'Demo Radio (test)',
    contactEmail: 'radio@example.test',
    status: 'archived',
    note: 'Test sponsor, finished.',
  },
];

const donations: DemoDonation[] = (
  [
    ['paid', 500000],
    ['paid', 1000000],
    ['paid', 200000],
    ['pending', 500000],
    ['failed', 300000],
    ['needs_review', 1500000],
  ] as const
).map(([status, amountKobo], i) => ({
  id: `don_demo_${i + 1}`,
  donor: `Demo Donor ${String(i + 1).padStart(2, '0')} (test)`,
  email: `donor${String(i + 1).padStart(2, '0')}@example.net`,
  amountKobo,
  status,
  test: true,
}));

export const DEMO_DATASET: DemoDataset = {
  staff,
  viewers: 12,
  categories: ['Life Skills', 'Science', 'Maths', 'Geography', 'Health'],
  series: [
    { id: 'ser_maths', title: 'Maths Made Simple' },
    { id: 'ser_life', title: 'Life Skills for Teens' },
    {
      id: 'ser_demo_parts',
      title: 'Demo series: Learn to budget',
      labels: { preset: 'part_lesson' },
    },
  ],
  videoStatusExamples: [
    { status: 'published', videoId: 'vid_money_data' },
    { status: 'scheduled', videoId: 'vid_magnets' },
    { status: 'ready', videoId: 'vid_safe_online' },
    { status: 'needs_captions', videoId: 'vid_plants' },
    { status: 'processing', videoId: 'vid_rivers' },
    { status: 'draft', videoId: 'vid_naira' },
    { status: 'failed', videoId: 'vid_solar' },
    { status: 'uploading', videoId: 'vid_demo_uploading' },
  ],
  sponsors,
  donations,
  emails() {
    return [
      ...this.staff.map((s) => s.email),
      ...this.sponsors.map((s) => s.contactEmail),
      ...this.donations.map((d) => d.email),
    ];
  },
};

const RESERVED_DOMAIN = /@(?:[a-z0-9-]+\.)*example\.(?:com|net|org|test)$/i;
// Eight or more digits in a row, with optional spaces, dashes, dots or a plus: looks like a phone number.
const PHONE = /\+?\d[\d\s().-]{6,}\d/;

/** Plain problems found in a dataset. Empty means it is clearly fake. */
export function checkDemoDataset(ds: DemoDataset): string[] {
  const problems: string[] = [];
  for (const e of ds.emails()) {
    if (!RESERVED_DOMAIN.test(e)) problems.push(`email ${e} is not on a reserved example domain`);
  }
  for (const s of ds.staff) {
    if (!/^Demo /.test(s.name)) problems.push(`staff name "${s.name}" must start with Demo`);
  }
  for (const s of ds.sponsors) {
    if (!/\(test\)$/.test(s.name)) problems.push(`sponsor "${s.name}" is not marked (test)`);
    if (PHONE.test(s.note)) problems.push(`sponsor note of ${s.id} looks like a phone number`);
  }
  for (const d of ds.donations) {
    if (!d.test) problems.push(`donation ${d.id} is not marked as test`);
    if (!/\(test\)$/.test(d.donor)) problems.push(`donor "${d.donor}" is not marked (test)`);
    if (d.amountKobo % 100_000 !== 0)
      problems.push(`donation ${d.id} amount is not a round figure`);
    if (d.note && PHONE.test(d.note))
      problems.push(`donation ${d.id} note looks like a phone number`);
  }
  return problems;
}
