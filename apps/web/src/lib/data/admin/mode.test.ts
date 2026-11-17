import { describe, expect, it } from 'vitest';
import { adminDataMode, delegating, fixtureDataAllowed } from './mode';

describe('admin data mode', () => {
  it('is real by default in development and production', () => {
    expect(adminDataMode({ NODE_ENV: 'development' })).toBe('real');
    expect(adminDataMode({ NODE_ENV: 'production' })).toBe('real');
    expect(adminDataMode({})).toBe('real');
  });
  it('is fixture by default under test', () => {
    expect(adminDataMode({ NODE_ENV: 'test' })).toBe('fixture');
  });
  it('lets ADMIN_DATA opt in to fixtures or real outside production', () => {
    expect(adminDataMode({ NODE_ENV: 'development', ADMIN_DATA: 'fixture' })).toBe('fixture');
    expect(adminDataMode({ NODE_ENV: 'test', ADMIN_DATA: 'real' })).toBe('real');
  });
  it('refuses fixtures in production whatever the switches say', () => {
    expect(() => adminDataMode({ NODE_ENV: 'production', ADMIN_DATA: 'fixture' })).toThrow(
      /production/i,
    );
    expect(() =>
      adminDataMode({ NODE_ENV: 'production', ADMIN_DATA: 'fixture', ADMIN_FIXTURES: 'on' }),
    ).toThrow(/production/i);
    expect(fixtureDataAllowed({ NODE_ENV: 'production' })).toBe(false);
    expect(fixtureDataAllowed({ NODE_ENV: 'production', ADMIN_FIXTURES: 'on' })).toBe(false);
    expect(fixtureDataAllowed({ NODE_ENV: 'development' })).toBe(true);
  });
  it('ignores unknown values', () => {
    expect(adminDataMode({ NODE_ENV: 'development', ADMIN_DATA: 'maybe' })).toBe('real');
  });
});

describe('delegating', () => {
  const make = (label: string) => ({
    async hello(name: string) {
      return `${label} ${name}`;
    },
  });
  it('calls the fixture implementation in fixture mode and loads the real one in real mode', async () => {
    let loaded = 0;
    const service = delegating(make('fixture'), async () => {
      loaded += 1;
      return make('real');
    });
    const before = process.env.ADMIN_DATA;
    try {
      process.env.ADMIN_DATA = 'fixture';
      expect(await service.hello('a')).toBe('fixture a');
      expect(loaded).toBe(0);
      process.env.ADMIN_DATA = 'real';
      expect(await service.hello('b')).toBe('real b');
      expect(await service.hello('c')).toBe('real c');
      expect(loaded).toBe(1);
    } finally {
      if (before === undefined) delete process.env.ADMIN_DATA;
      else process.env.ADMIN_DATA = before;
    }
  });
});
