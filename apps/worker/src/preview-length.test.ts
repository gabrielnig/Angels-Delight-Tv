import { describe, expect, it } from 'vitest';
import { heroClipMsReader } from './preview-length';

/** A db whose settings table holds `value` for every key (undefined means no row). */
const dbWith = (value: unknown) =>
  ({
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => (value === undefined ? [] : [{ value }]) }) }),
    }),
  }) as never;

describe('heroClipMsReader', () => {
  it('reads home.hero_clip_seconds as milliseconds', async () => {
    expect(await heroClipMsReader(dbWith(12))()).toBe(12_000);
  });
  it('uses 20 seconds when the setting was never saved', async () => {
    expect(await heroClipMsReader(dbWith(undefined))()).toBe(20_000);
  });
  it('uses 20 seconds when the stored value is out of range', async () => {
    expect(await heroClipMsReader(dbWith(99))()).toBe(20_000);
  });
});
