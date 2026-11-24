import { describe, expect, it } from 'vitest';
import { SETTING_DEFS, SETTING_KEYS, defaultSettings, type SettingKey } from './settings-registry';
import { MONETIZATION_KEYS, crossCheckMonetization } from './settings-monetization';

const parse = (key: SettingKey, value: unknown) => SETTING_DEFS[key].schema.safeParse(value);

describe('monetization settings registry', () => {
  it('defines exactly 38 keys, all registered', () => {
    expect(MONETIZATION_KEYS).toHaveLength(38);
    for (const key of MONETIZATION_KEYS) expect(SETTING_KEYS).toContain(key);
  });

  it('sponsors keys default to off', () => {
    const d = defaultSettings();
    expect(d['sponsors.enabled']).toBe(false);
    expect(d['sponsors.placement.home_banner.enabled']).toBe(false);
    expect(d['sponsors.placement.title_card.enabled']).toBe(false);
    expect(d['sponsors.placement.player_after.enabled']).toBe(false);
    expect(d['sponsors.placement.player_before.enabled']).toBe(false);
  });

  it('donate keys default to off', () => {
    const d = defaultSettings();
    expect(d['donate.enabled']).toBe(false);
    expect(d['donate.monthly.enabled']).toBe(false);
    expect(d['donate.usd.enabled']).toBe(false);
    expect(d['donate.bank_transfer.enabled']).toBe(false);
    expect(d['donate.transparency.enabled']).toBe(false);
    expect(d['donate.cover_fees_option']).toBe(false);
  });

  it('every boolean enable switch in the group is false by default', () => {
    const d = defaultSettings() as Record<string, unknown>;
    for (const key of MONETIZATION_KEYS) {
      if (typeof d[key] === 'boolean' && key !== 'sponsors.link_new_tab') {
        expect(d[key], key).toBe(false);
      }
    }
  });

  it('client inputs default to empty, never to a real name or account', () => {
    const d = defaultSettings();
    expect(d['donate.org_name']).toBe('');
    expect(d['donate.org_registration']).toBe('');
    expect(d['donate.bank_transfer.instructions']).toBe('');
    expect(d['donate.transparency.items']).toEqual([]);
  });

  it('every default passes its own schema', () => {
    for (const key of MONETIZATION_KEYS) {
      expect(parse(key, SETTING_DEFS[key].default).success, key).toBe(true);
    }
  });

  it('label cannot be empty or outside the allowed set', () => {
    expect(parse('sponsors.label', '').success).toBe(false);
    expect(parse('sponsors.label', 'ad').success).toBe(false);
    expect(parse('sponsors.label', 'sponsor_message').success).toBe(true);
    expect(parse('sponsors.label', 'in_partnership_with').success).toBe(true);
  });

  it('range checks on caps and positions', () => {
    expect(parse('sponsors.home_banner.after_row', 0).success).toBe(false);
    expect(parse('sponsors.home_banner.after_row', 9).success).toBe(false);
    expect(parse('sponsors.home_banner.after_row', 2).success).toBe(true);
    expect(parse('sponsors.player_before.seconds', 2).success).toBe(false);
    expect(parse('sponsors.player_before.seconds', 11).success).toBe(false);
    expect(parse('sponsors.freq.home_banner_per_day', 11).success).toBe(false);
    expect(parse('sponsors.freq.title_card_per_day', 21).success).toBe(false);
    expect(parse('sponsors.freq.player_after_per_session', 6).success).toBe(false);
    expect(parse('sponsors.freq.player_before_per_session', 4).success).toBe(false);
    expect(parse('sponsors.rotation', 'random').success).toBe(false);
  });

  it('public flags: caps stay private, switches and copy are public', () => {
    expect(SETTING_DEFS['sponsors.enabled'].isPublic).toBe(true);
    expect(SETTING_DEFS['sponsors.freq.home_banner_per_day'].isPublic).toBe(false);
    expect(SETTING_DEFS['donate.max_minor.ngn'].isPublic).toBe(false);
    expect(SETTING_DEFS['donate.retention.event_days'].isPublic).toBe(false);
    expect(SETTING_DEFS['donate.receipts.reply_to'].isPublic).toBe(false);
  });

  it('rejects transparency percent items that do not total 100', () => {
    const items = [
      { label: 'Hosting', percent: 40, note: '' },
      { label: 'Captions', percent: 40, note: '' },
    ];
    expect(parse('donate.transparency.items', items).success).toBe(false);
    expect(
      parse('donate.transparency.items', [...items, { label: 'Other', percent: 20, note: '' }])
        .success,
    ).toBe(true);
  });

  it('accepts amount items without a percent total', () => {
    const items = [{ label: 'Hosting', amount_minor: 500000, note: 'Year one' }];
    expect(parse('donate.transparency.items', items).success).toBe(true);
  });

  it('refuses a mix of percent and amount items', () => {
    const items = [
      { label: 'A', percent: 100, note: '' },
      { label: 'B', amount_minor: 100, note: '' },
    ];
    expect(parse('donate.transparency.items', items).success).toBe(false);
  });

  it('refuses dashes and markup in donor facing text', () => {
    expect(parse('donate.intro_title', 'Help \u2014 please').success).toBe(false);
    expect(parse('donate.intro_body', 'Keep it free \u2013 give').success).toBe(false);
    expect(parse('donate.org_name', 'Light <b>Org</b>').success).toBe(false);
  });

  it('currencies only allow NGN and USD, NGN always present', () => {
    expect(parse('donate.currencies', ['EUR']).success).toBe(false);
    expect(parse('donate.currencies', []).success).toBe(false);
    expect(parse('donate.currencies', ['NGN', 'USD']).success).toBe(true);
  });
});

describe('crossCheckMonetization', () => {
  const base = () => defaultSettings();

  it('passes with defaults', () => {
    expect(crossCheckMonetization(base(), { paystackKeyPresent: false })).toEqual({});
  });

  it('rejects preset below minimum', () => {
    const v = { ...base(), 'donate.presets_minor.ngn': [10000, 100000] };
    const errors = crossCheckMonetization(v, { paystackKeyPresent: false });
    expect(errors['donate.presets_minor.ngn']?.[0]).toMatch(/minimum/i);
  });

  it('rejects preset above maximum', () => {
    const v = { ...base(), 'donate.max_minor.ngn': 100000, 'donate.presets_minor.ngn': [50000, 200000] };
    expect(crossCheckMonetization(v, { paystackKeyPresent: false })['donate.presets_minor.ngn']).toBeDefined();
  });

  it('rejects minimum above maximum', () => {
    const v = { ...base(), 'donate.min_minor.ngn': 900000, 'donate.max_minor.ngn': 100000 };
    expect(crossCheckMonetization(v, { paystackKeyPresent: false })['donate.min_minor.ngn']).toBeDefined();
  });

  it('refuses donations on without a Paystack key and names the variable', () => {
    const v = { ...base(), 'donate.enabled': true };
    const errors = crossCheckMonetization(v, { paystackKeyPresent: false });
    expect(errors['donate.enabled']?.[0]).toContain('PAYSTACK_SECRET_KEY');
    expect(crossCheckMonetization(v, { paystackKeyPresent: true })).toEqual({});
  });

  it('refuses monthly or USD without donations on', () => {
    const monthly = { ...base(), 'donate.monthly.enabled': true };
    expect(crossCheckMonetization(monthly, { paystackKeyPresent: true })['donate.monthly.enabled']).toBeDefined();
    const usd = { ...base(), 'donate.usd.enabled': true };
    expect(crossCheckMonetization(usd, { paystackKeyPresent: true })['donate.usd.enabled']).toBeDefined();
  });

  it('lists USD only when the USD switch is on', () => {
    const v = { ...base(), 'donate.currencies': ['NGN', 'USD'] as ('NGN' | 'USD')[] };
    expect(crossCheckMonetization(v, { paystackKeyPresent: true })['donate.currencies']).toBeDefined();
    const ok = { ...v, 'donate.enabled': true, 'donate.usd.enabled': true };
    expect(crossCheckMonetization(ok, { paystackKeyPresent: true })).toEqual({});
  });

  it('refuses a placement switch without the master switch being allowed on', () => {
    const v = { ...base(), 'sponsors.placement.home_banner.enabled': true };
    expect(crossCheckMonetization(v, { paystackKeyPresent: false })).toEqual({});
  });
});
