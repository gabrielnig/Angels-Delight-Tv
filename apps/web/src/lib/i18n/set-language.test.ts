import { describe, expect, it, vi } from 'vitest';
import { setLanguage, type SetLanguageDeps } from './set-language';

const deps = (over: Partial<SetLanguageDeps> = {}): SetLanguageDeps & {
  setCookie: ReturnType<typeof vi.fn>;
  saveProfile: ReturnType<typeof vi.fn>;
} => ({
  enabled: async () => ['en', 'yo'],
  session: async () => null,
  setCookie: vi.fn(),
  saveProfile: vi.fn(async () => undefined),
  ...over,
}) as never;

describe('setLanguage', () => {
  it('a guest choice sets the cookie only', async () => {
    const d = deps();
    expect(await setLanguage('yo', d)).toEqual({ ok: true, locale: 'yo' });
    expect(d.setCookie).toHaveBeenCalledWith('yo');
    expect(d.saveProfile).not.toHaveBeenCalled();
  });
  it('a signed in choice also updates the profile', async () => {
    const d = deps({ session: async () => ({ accountId: 'a', profileId: 'p', kids: false }) });
    await setLanguage('yo', d);
    expect(d.setCookie).toHaveBeenCalledWith('yo');
    expect(d.saveProfile).toHaveBeenCalledWith('a', 'p', 'yo');
  });
  it('an unsupported or disabled code is rejected', async () => {
    const d = deps();
    expect(await setLanguage('fr', d)).toEqual({ ok: false, reason: 'unsupported' });
    expect(await setLanguage('ha', d)).toEqual({ ok: false, reason: 'unsupported' });
    expect(d.setCookie).not.toHaveBeenCalled();
  });
  it('a kids profile cannot change language here', async () => {
    const d = deps({ session: async () => ({ accountId: 'a', profileId: 'p', kids: true }) });
    expect(await setLanguage('yo', d)).toEqual({ ok: false, reason: 'kids' });
    expect(d.setCookie).not.toHaveBeenCalled();
  });
});
