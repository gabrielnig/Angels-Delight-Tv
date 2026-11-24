import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  role: 'editor' as string,
  save: null as null | ((a: unknown, id: string, p: unknown) => Promise<unknown>),
  revalidated: [] as string[],
}));

vi.mock('@/lib/data/admin/session-next', () => ({
  requireActionActor: async () => ({ accountId: 'a', role: state.role, name: 'A' }),
}));
vi.mock('@/lib/data/admin/markers', () => ({
  markersAdmin: { save: (a: unknown, id: string, p: unknown) => state.save!(a, id, p) },
}));
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => void state.revalidated.push(path),
}));

import { Forbidden, ValidationFailed } from '@ad/shared';
import { saveMarkersAction } from './actions';

const payload = {
  markers: [{ kind: 'intro' as const, startMs: 12_000, endMs: 48_000 }],
  chapters: [{ startMs: 0, title: 'Welcome' }],
};

beforeEach(() => {
  state.role = 'editor';
  state.revalidated = [];
  state.save = async () => undefined;
});

describe('saveMarkersAction', () => {
  it('saves for an editor', async () => {
    const seen: unknown[] = [];
    state.save = async (_a, id, p) => void seen.push([id, p]);
    expect(await saveMarkersAction('v1', payload)).toEqual({ ok: true });
    expect(seen).toEqual([['v1', payload]]);
  });

  it('returns field errors for invalid input', async () => {
    state.save = async () => {
      throw new ValidationFailed({ intro: ['Intro must end after it starts.'], chapters: ['x', 'y'] });
    };
    expect(await saveMarkersAction('v1', payload)).toEqual({
      ok: false,
      errors: { intro: 'Intro must end after it starts.', chapters: 'x' },
    });
  });

  it('denies a viewer role', async () => {
    state.save = async () => {
      throw new Forbidden('Only editors and admins edit skip markers');
    };
    await expect(saveMarkersAction('v1', payload)).rejects.toBeInstanceOf(Forbidden);
  });

  it('revalidates the admin pages and the watch path', async () => {
    await saveMarkersAction('v1', payload);
    expect(state.revalidated).toContain('/admin');
    expect(state.revalidated).toContain('/watch/v1');
  });
});
