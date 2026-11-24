import { FieldErrors } from '@ad/auth';
import { RateLimited } from '@ad/shared';
import { describe, expect, it, vi } from 'vitest';
import { RealAccountRepository } from './account-repo';
import type { GatewayIo } from './gateway';

const actor = { accountId: 'a1', role: 'viewer' as const, sessionId: 's1' };

function setup(parts: {
  service?: Record<string, unknown>;
  history?: unknown;
  sessions?: unknown;
}) {
  const clearSession = vi.fn(async () => undefined);
  const io = {
    meta: async () => ({ ip: null, ipTrunc: null, userAgent: null, requestId: null }),
    currentActor: async () => actor,
    clearSession,
  } as unknown as GatewayIo;
  const repo = new RealAccountRepository(
    (parts.service ?? {}) as never,
    (parts.sessions ?? {}) as never,
    io,
    () => new Date('2026-03-01T10:00:00Z'),
    undefined,
    undefined,
    parts.history as never,
  );
  return { repo, clearSession };
}

describe('RealAccountRepository sign out everywhere', () => {
  it('ends every session and clears this browser cookie', async () => {
    const signOutEverywhere = vi.fn(async () => undefined);
    const { repo, clearSession } = setup({ service: { signOutEverywhere } });
    expect(await repo.signOutEverywhere('a1', 'pw')).toEqual({ ok: true });
    expect(signOutEverywhere).toHaveBeenCalledWith(actor, 'pw', expect.anything());
    expect(clearSession).toHaveBeenCalled();
  });

  it('keeps the cookie and says the password is wrong', async () => {
    const { repo, clearSession } = setup({
      service: {
        signOutEverywhere: async () => {
          throw new FieldErrors({ password: 'x' });
        },
      },
    });
    expect(await repo.signOutEverywhere('a1', 'bad')).toEqual({
      ok: false,
      reason: 'wrong_password',
    });
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('reports a lock and any other failure as network', async () => {
    const locked = setup({
      service: {
        signOutEverywhere: async () => {
          throw new RateLimited(120);
        },
      },
    });
    expect(await locked.repo.signOutEverywhere('a1', 'x')).toMatchObject({
      ok: false,
      reason: 'locked',
      minutes: 2,
    });
    const broken = setup({
      service: {
        signOutEverywhere: async () => {
          throw new Error('db');
        },
      },
    });
    expect(await broken.repo.signOutEverywhere('a1', 'x')).toEqual({
      ok: false,
      reason: 'network',
    });
  });
});

describe('RealAccountRepository login history and device places', () => {
  it('shows country names and a readable time, never an address', async () => {
    const { repo } = setup({
      history: async () => [
        {
          id: 'e1',
          at: new Date('2026-03-01T09:00:00Z'),
          outcome: 'success',
          country: 'NG',
          newDevice: true,
          device: 'phone',
          deviceLabel: 'Chrome on Android',
        },
        {
          id: 'e2',
          at: new Date('2026-02-28T09:00:00Z'),
          outcome: 'failed',
          country: null,
          newDevice: false,
          device: 'computer',
          deviceLabel: 'Edge on Windows',
        },
      ],
    });
    const rows = await repo.loginHistory('a1');
    expect(rows[0]).toEqual({
      id: 'e1',
      when: '1 hour ago',
      outcome: 'success',
      place: 'Nigeria',
      deviceLabel: 'Chrome on Android',
      device: 'phone',
      newDevice: true,
    });
    expect(rows[1]?.place).toBe('Location unknown');
  });

  it('is empty when history is not wired', async () => {
    expect(await setup({}).repo.loginHistory('a1')).toEqual([]);
  });

  it('lists a device place from the session country', async () => {
    const { repo } = setup({
      sessions: {
        list: async () => [
          {
            id: 's1',
            lastSeenAt: new Date('2026-03-01T10:00:00Z'),
            ipTrunc: '203.0.113.0/24',
            userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) Chrome/120.0 Safari/537',
            country: 'GH',
          },
        ],
      },
    });
    const [row] = await repo.devices('a1');
    expect(row?.place).toBe('Ghana');
    expect(row?.kind).toBe('phone');
  });
});
