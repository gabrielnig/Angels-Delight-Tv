import 'server-only';
import { Forbidden, isStaffRole } from '@ad/shared';
import { delegating } from './mode';
import type { AdminActor } from './types';

export interface NoticeDto {
  id: string;
  kind: 'encode_done' | 'encode_failed' | 'captions_ready' | 'captions_failed';
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  read: boolean;
}

export interface NoticeFeed {
  items: NoticeDto[];
  unread: number;
}

export interface NotificationPrefsDto {
  failures: boolean;
  captionsReady: boolean;
  dailySummary: boolean;
  emailFrequency: 'immediate' | 'hourly' | 'daily';
}

export interface NoticesService {
  feed(actor: AdminActor): Promise<NoticeFeed>;
  markAllRead(actor: AdminActor): Promise<void>;
  prefs(actor: AdminActor): Promise<NotificationPrefsDto>;
  setPrefs(
    actor: AdminActor,
    patch: Partial<NotificationPrefsDto>,
  ): Promise<{ ok: true; prefs: NotificationPrefsDto } | { ok: false; error: string }>;
}

const DEFAULT_PREFS: NotificationPrefsDto = {
  failures: true,
  captionsReady: false,
  dailySummary: false,
  emailFrequency: 'hourly',
};

let readIds = new Set<string>();
let prefsByAccount = new Map<string, NotificationPrefsDto>();
export function resetNoticeFixture(): void {
  readIds = new Set();
  prefsByAccount = new Map();
}

const SEED: Omit<NoticeDto, 'read'>[] = [
  {
    id: 'fixture-notice-1',
    kind: 'captions_ready',
    title: 'Captions ready to review',
    body: 'Fractions made easy',
    href: '/admin/captions',
    createdAt: '2026-11-17T08:00:00.000Z',
  },
  {
    id: 'fixture-notice-2',
    kind: 'encode_failed',
    title: 'Encoding failed',
    body: 'Rainy day science: The file could not be read.',
    href: '/admin/videos',
    createdAt: '2026-11-16T15:30:00.000Z',
  },
];

function guard(actor: AdminActor): void {
  if (!isStaffRole(actor.role)) throw new Forbidden();
}

const fixture: NoticesService = {
  async feed(actor) {
    guard(actor);
    const items = SEED.map((n) => ({ ...n, read: readIds.has(n.id) }));
    return { items, unread: items.filter((n) => !n.read).length };
  },
  async markAllRead(actor) {
    guard(actor);
    for (const n of SEED) readIds.add(n.id);
  },
  async prefs(actor) {
    guard(actor);
    return { ...(prefsByAccount.get(actor.accountId) ?? DEFAULT_PREFS) };
  },
  async setPrefs(actor, patch) {
    guard(actor);
    if (patch.emailFrequency && !['immediate', 'hourly', 'daily'].includes(patch.emailFrequency)) {
      return { ok: false, error: 'Choose at once, hourly or daily.' };
    }
    const next = { ...(prefsByAccount.get(actor.accountId) ?? DEFAULT_PREFS), ...patch };
    prefsByAccount.set(actor.accountId, next);
    return { ok: true, prefs: { ...next } };
  },
};

export const noticesAdmin: NoticesService = delegating(
  fixture,
  async () => (await import('./real/notices')).realNotices,
);
