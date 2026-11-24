import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('server-only', () => ({}));
vi.mock('../../lib/data/admin/theme-runtime', () => ({
  themeRuntime: async () => ({ settings: { get } }),
}));

import { airplayEnabled, playerCountdownSeconds } from './player-settings';

beforeEach(() => {
  get.mockReset();
});

describe('playerCountdownSeconds (L4-08)', () => {
  it('reads playback.countdown_seconds from the site settings', async () => {
    get.mockResolvedValue(8);
    expect(await playerCountdownSeconds()).toBe(8);
    expect(get).toHaveBeenCalledWith('playback.countdown_seconds');
  });

  it('keeps the value inside 5 to 10 even if storage holds something else', async () => {
    get.mockResolvedValue(30);
    expect(await playerCountdownSeconds()).toBe(10);
    get.mockResolvedValue(1);
    expect(await playerCountdownSeconds()).toBe(5);
  });

  it('uses 5 when the settings cannot be read', async () => {
    get.mockImplementation(() => {
      throw new Error('down');
    });
    expect(await playerCountdownSeconds()).toBe(5);
  });
});

describe('airplayEnabled (L4-10, R16)', () => {
  it('reads features.airplay and is off by default', async () => {
    get.mockResolvedValue(true);
    expect(await airplayEnabled()).toBe(true);
    expect(get).toHaveBeenCalledWith('features.airplay');
    get.mockResolvedValue(false);
    expect(await airplayEnabled()).toBe(false);
  });

  it('is off when the settings cannot be read or hold something else', async () => {
    get.mockImplementation(() => {
      throw new Error('down');
    });
    expect(await airplayEnabled()).toBe(false);
    get.mockReset();
    get.mockResolvedValue('yes');
    expect(await airplayEnabled()).toBe(false);
  });
});
