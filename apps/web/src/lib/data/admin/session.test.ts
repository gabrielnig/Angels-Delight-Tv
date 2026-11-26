import { describe, expect, it } from 'vitest';
import { createFixtureAuth, fixtureEmailStep, FIXTURE_PASSWORD } from './session';

describe('fixture admin sign in', () => {
  it('signs in a fixture admin with the right password', () => {
    const auth = createFixtureAuth({ now: () => 0 });
    const result = auth.checkPassword('chiamaka@example.test', FIXTURE_PASSWORD);
    expect(result).toMatchObject({ ok: true, actor: { role: 'admin', name: 'Chiamaka Okafor' } });
  });

  it('gives one generic answer for a wrong password and for an unknown email', () => {
    const auth = createFixtureAuth({ now: () => 0 });
    expect(auth.checkPassword('chiamaka@example.test', 'nope')).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(auth.checkPassword('nobody@example.test', 'nope')).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('does not let a viewer account into admin', () => {
    const auth = createFixtureAuth({ now: () => 0 });
    expect(auth.checkPassword('viewer@example.test', FIXTURE_PASSWORD)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('locks after 5 failures for 15 minutes then lets the person back in', () => {
    let clock = 0;
    const auth = createFixtureAuth({ now: () => clock });
    for (let i = 0; i < 5; i++) auth.checkPassword('ngozi@example.test', 'bad');
    expect(auth.checkPassword('ngozi@example.test', FIXTURE_PASSWORD)).toEqual({
      ok: false,
      reason: 'locked',
      retryInMinutes: 15,
    });
    clock = 16 * 60_000;
    expect(auth.checkPassword('ngozi@example.test', FIXTURE_PASSWORD).ok).toBe(true);
  });

  it('checks the two factor code and counts tries left', () => {
    const auth = createFixtureAuth({ now: () => 0 });
    expect(auth.checkCode('acc_chiamaka', '123456')).toEqual({ ok: true });
    expect(auth.checkCode('acc_chiamaka', '000000')).toEqual({ ok: false, triesLeft: 4 });
  });

  it('finds an actor by account id', () => {
    const auth = createFixtureAuth({ now: () => 0 });
    expect(auth.actorFor('acc_ngozi')?.role).toBe('editor');
    expect(auth.actorFor('acc_missing')).toBeNull();
  });
});

describe('demo names (KB_DEMO)', () => {
  it('shows clearly fake names for the recording stack and the normal names otherwise', () => {
    const auth = createFixtureAuth({ now: () => 0 });
    expect(auth.actorFor('acc_ngozi')?.name).toBe('Ngozi Eze');
    process.env.KB_DEMO = 'on';
    try {
      expect(auth.actorFor('acc_ngozi')?.name).toBe('Demo Editor');
      expect(auth.actorFor('acc_chiamaka')?.name).toBe('Demo Admin');
      expect(auth.actorFor('acc_arkdev')?.name).toBe('Demo Owner');
    } finally {
      delete process.env.KB_DEMO;
    }
  });
});

describe('fixture email step', () => {
  it('is on only for the knowledge base demo', () => {
    expect(fixtureEmailStep({ KB_DEMO: 'on' })).toBe(true);
    expect(fixtureEmailStep({ KB_DEMO: 'off' })).toBe(false);
    expect(fixtureEmailStep({})).toBe(false);
  });
});
