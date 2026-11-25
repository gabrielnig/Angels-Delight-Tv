import { describe, expect, it } from 'vitest';
import { formatFindings, scanText } from './scan';

// Built at run time so no source line looks like a real key to secret scanners.
const SK = ['sk', 'live', '4eC39HqLyjWDarjtT1zdp7dc'].join('_');
const PK = ['pk', 'test', 'TYooMQauvdEDq54NiTphI7jx'].join('_');

const kinds = (t: string) => scanText(t).map((f) => f.kind);

describe('redaction scanner: things that must fail a capture', () => {
  it('flags a real looking email but not the reserved example domains', () => {
    expect(kinds('Write to ceo@realcompany.com today')).toEqual(['email']);
    expect(
      kinds('demo@example.com demo@example.net a@example.org b@example.test c@x.example.test'),
    ).toEqual([]);
  });

  it('flags the marker the page redactor leaves, because a real email reached the screen', () => {
    expect(kinds('Owner: [email hidden]')).toEqual(['hidden-email']);
  });

  it.each([
    ['a Stripe style secret key', SK],
    ['a publishable key', PK],
    ['an AWS access key id', ['AKIA', 'IOSFODNN7EXAMPLE'].join('')],
    [
      'a JWT',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    ],
    ['a bearer token', 'Authorization: Bearer abcdefghijklmnop1234567890'],
    ['a long mixed token', 'Q2xhdWRlSXNOb3RBUmVhbFRva2VuMTIzNDU2Nzg5MEFiQ2RFZg'],
    ['a long hex secret', '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'],
  ])('flags %s', (_name, text) => {
    expect(kinds(`value: ${text}`)).toContain('secret');
  });

  it.each([
    ['a Nigerian mobile', 'Call 0803 123 4567'],
    ['a Nigerian mobile without spaces', 'Call 08031234567'],
    ['an international number', 'Phone +234 803 123 4567'],
    ['a US number', 'Phone +1 (415) 555-2671'],
    ['a dashed number', 'Phone 415-555-2671'],
  ])('flags %s', (_name, text) => {
    expect(kinds(text)).toEqual(['phone']);
  });

  it('flags an IP address that is not loopback or a documentation range', () => {
    expect(kinds('Server 41.58.12.9 is up')).toEqual(['ip']);
    expect(kinds('Server 192.0.2.10 198.51.100.7 203.0.113.9 127.0.0.1 is up')).toEqual([]);
  });
});

describe('redaction scanner: ordinary screen text must pass', () => {
  it.each([
    'Rivers of Africa',
    'Length 5:11',
    'Published 24 Feb',
    'Views 12.4k',
    'Storage 1.1 GB of 20 GB',
    'Scheduled 2026-03-10T09:00:00.000Z',
    'Release v1.2.3 (abc1234)',
    'Failed 20 minutes ago. The audio track could not be read.',
    'Order 2026 0310 1000',
    '4 items, 84 cues waiting since yesterday',
    'Reference KB-2026-03-10-A1B2',
    'id 3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    'a-very-long-hyphenated-title-about-saving-data-on-your-phone-every-month',
    'N1,500,000 from 6 gifts',
  ])('passes "%s"', (t) => expect(scanText(t)).toEqual([]));
});

describe('findings never repeat the secret', () => {
  it('shows a short masked excerpt with the position of the match', () => {
    const [f] = scanText(`key ${SK} here`);
    expect(f!.excerpt).not.toContain(SK.slice(8));
    expect(f!.excerpt.startsWith('sk_')).toBe(true);
    expect(formatFindings('step 3', [f!])).toMatch(/step 3.*secret/s);
    expect(formatFindings('step 3', [f!])).not.toContain(SK.slice(8));
  });

  it('allows a listed exact value', () => {
    expect(scanText('Call 0803 123 4567', { allow: ['0803 123 4567'] })).toEqual([]);
  });
});
