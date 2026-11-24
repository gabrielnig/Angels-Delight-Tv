import { describe, expect, it } from 'vitest';
import { createMailLocalizer } from './localization';

const catalog = { 'mail.welcome.subject': 'Kaabo' };

describe('createMailLocalizer', () => {
  it('maps an address to the account locale and its catalog', async () => {
    const localize = createMailLocalizer({
      accountIdFor: async (address) => (address === 'ada@example.com' ? 'a1' : null),
      localeOf: async (id) => (id === 'a1' ? 'yo' : null),
      catalogOf: async (locale) => (locale === 'yo' ? catalog : {}),
    });
    expect(await localize('Ada@Example.com ')).toEqual({ locale: 'yo', catalog });
  });
  it('is English for an unknown address, an English account or a locale that is not enabled', async () => {
    const localize = createMailLocalizer({
      accountIdFor: async (address) => (address === 'none@example.com' ? null : 'a1'),
      localeOf: async () => 'en',
      catalogOf: async () => catalog,
    });
    expect(await localize('none@example.com')).toBeUndefined();
    expect(await localize('ada@example.com')).toBeUndefined();
    const disabled = createMailLocalizer({
      accountIdFor: async () => 'a1',
      localeOf: async () => 'ha',
      catalogOf: async () => catalog,
      enabled: async () => ['en', 'yo'],
    });
    expect(await disabled('ada@example.com')).toBeUndefined();
  });
});
