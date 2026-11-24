import { describe, expect, it, vi } from 'vitest';
import { setGuestAudience } from './set-guest-audience';

describe('setGuestAudience', () => {
  it('stores k for Kids mode and g for general, with the cookie options', () => {
    const jar = { set: vi.fn() };
    setGuestAudience(jar, true, true);
    setGuestAudience(jar, false, false);
    expect(jar.set).toHaveBeenNthCalledWith(
      1,
      '__Host-ad_gaud',
      'k',
      expect.objectContaining({ secure: true, httpOnly: true, path: '/' }),
    );
    expect(jar.set).toHaveBeenNthCalledWith(
      2,
      'ad_gaud',
      'g',
      expect.objectContaining({ secure: false }),
    );
  });

  it('accepts only a boolean, so a junk value is never stored', () => {
    const jar = { set: vi.fn() };
    expect(() => setGuestAudience(jar, 'k' as never, true)).toThrow();
    expect(jar.set).not.toHaveBeenCalled();
  });
});
