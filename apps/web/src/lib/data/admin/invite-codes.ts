import 'server-only';
import { Forbidden } from '@ad/shared';
import { can } from '@/lib/admin/can';
import { delegating } from './mode';
import type { InviteCodeDto, InviteCodeResult, InviteCodesService } from './site-types';

/**
 * Invite codes for viewer sign up (M29-S03). The real service is the lane B staff service; the in memory one
 * serves fixture runs and unit tests. Same rules in both: admins only, the code is shown once.
 */

interface Stored extends InviteCodeDto {
  code: string;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let memory: Stored[] = [];

export function resetInviteCodeFixture(): void {
  memory = [];
}

function code(): string {
  let out = '';
  for (let i = 0; i < 10; i += 1) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8)}`;
}

const status = (row: Stored, now: Date): InviteCodeDto['status'] =>
  row.status === 'revoked'
    ? 'revoked'
    : row.expiresAt && new Date(row.expiresAt) <= now
      ? 'expired'
      : row.uses >= row.maxUses
        ? 'used_up'
        : 'active';

const view = (): InviteCodeDto[] =>
  memory.map(({ code: _code, ...rest }) => ({ ...rest, status: status({ ...rest, code: _code }, new Date()) }));

function guard(role: Parameters<typeof can>[0]): void {
  if (!can(role, 'settings.site')) throw new Forbidden();
}

const fixture: InviteCodesService = {
  async list(actor) {
    guard(actor.role);
    return view();
  },
  async create(actor, input): Promise<InviteCodeResult> {
    if (!can(actor.role, 'settings.site')) return { ok: false, error: 'You do not have permission for this.' };
    if (!Number.isInteger(input.maxUses) || input.maxUses < 1 || input.maxUses > 1000)
      return { ok: false, error: 'Use a number from 1 to 1000' };
    if (input.expiresAt && new Date(input.expiresAt) <= new Date())
      return { ok: false, error: 'Choose a date in the future' };
    if (input.label.trim().length > 60) return { ok: false, error: 'Use 60 characters or fewer' };
    const value = code();
    memory.unshift({
      id: `fixture-${memory.length + 1}-${Date.now()}`,
      label: input.label.trim(),
      hint: value.slice(-2),
      uses: 0,
      maxUses: input.maxUses,
      expiresAt: input.expiresAt,
      createdAt: new Date().toISOString(),
      status: 'active',
      code: value,
    });
    return { ok: true, invites: view(), code: value };
  },
  async revoke(actor, id): Promise<InviteCodeResult> {
    if (!can(actor.role, 'settings.site')) return { ok: false, error: 'You do not have permission for this.' };
    const row = memory.find((item) => item.id === id && item.status !== 'revoked');
    if (!row) return { ok: false, error: 'That code no longer exists.' };
    row.status = 'revoked';
    return { ok: true, invites: view() };
  },
};

export const inviteCodesAdmin: InviteCodesService = delegating(
  fixture,
  async () => (await import('./real/invite-codes')).realInviteCodes,
);
