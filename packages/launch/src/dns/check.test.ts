import { describe, expect, it } from 'vitest';
import {
  CLOUDFLARE_IPV4_RANGES,
  domainOfAddress,
  inRanges,
  runDnsCheck,
  type DnsConfig,
  type DnsResolver,
} from './check';

type Zone = {
  a?: Record<string, string[]>;
  txt?: Record<string, string[]>;
  cname?: Record<string, string[]>;
  fail?: Record<string, string>;
};

/** A resolver that answers from a table and throws the way node does for a missing name. */
function fake(zone: Zone): DnsResolver {
  const lookup = <T>(table: Record<string, T> | undefined, name: string, kind: string): T => {
    const failure = zone.fail?.[`${kind}:${name}`];
    if (failure) throw Object.assign(new Error(failure), { code: failure });
    const found = table?.[name.toLowerCase()];
    if (!found) throw Object.assign(new Error(`${kind} ${name}`), { code: 'ENODATA' });
    return found;
  };
  return {
    resolve4: async (name) => lookup(zone.a, name, 'A'),
    resolveTxt: async (name) => lookup(zone.txt, name, 'TXT'),
    resolveCname: async (name) => lookup(zone.cname, name, 'CNAME'),
  };
}

const config: DnsConfig = {
  appDomain: 'tv.example.org',
  mediaDomain: 'media.example.org',
  fromDomain: 'example.org',
  vpsIp: '203.0.113.10',
  dkimSelectors: ['s1'],
};

const good: Zone = {
  a: {
    'tv.example.org': ['203.0.113.10'],
    'www.tv.example.org': ['203.0.113.10'],
    'media.example.org': ['104.18.2.3'],
  },
  txt: {
    'example.org': ['v=spf1 include:_spf.mail.test -all'],
    's1._domainkey.example.org': ['v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GN'],
    '_dmarc.example.org': ['v=DMARC1; p=quarantine; rua=mailto:dmarc@example.org'],
  },
};

const status = (report: Awaited<ReturnType<typeof runDnsCheck>>, id: string) =>
  report.checks.find((check) => check.id === id)?.status;

describe('domainOfAddress', () => {
  it('finds the domain in a plain or named address', () => {
    expect(domainOfAddress('Angels Delight TV <no-reply@Mail.Example.org>')).toBe(
      'mail.example.org',
    );
    expect(domainOfAddress('no-reply@example.org')).toBe('example.org');
    expect(domainOfAddress('nonsense')).toBeUndefined();
    expect(domainOfAddress(undefined)).toBeUndefined();
  });
});

describe('inRanges', () => {
  it('matches addresses inside a CIDR range and nothing else', () => {
    expect(inRanges('104.18.2.3', CLOUDFLARE_IPV4_RANGES)).toBe(true);
    expect(inRanges('203.0.113.10', CLOUDFLARE_IPV4_RANGES)).toBe(false);
    expect(inRanges('1.2.3.4', ['1.2.3.0/24'])).toBe(true);
    expect(inRanges('1.2.4.4', ['1.2.3.0/24'])).toBe(false);
    expect(inRanges('not an ip', ['1.2.3.0/24'])).toBe(false);
  });
});

describe('runDnsCheck with everything right', () => {
  it('passes every check with no network', async () => {
    const report = await runDnsCheck(config, fake(good));
    expect(report.ok).toBe(true);
    expect(report.checks.map((c) => [c.id, c.status])).toEqual([
      ['app-domain', 'pass'],
      ['app-www', 'pass'],
      ['media-domain', 'pass'],
      ['spf', 'pass'],
      ['dkim:s1', 'pass'],
      ['dmarc', 'pass'],
    ]);
  });

  it('accepts a proxied app domain, since DNS then shows Cloudflare addresses', async () => {
    const zone = {
      ...good,
      a: { ...good.a, 'tv.example.org': ['104.18.9.9'], 'www.tv.example.org': ['104.18.9.9'] },
    };
    const report = await runDnsCheck(config, fake(zone));
    expect(status(report, 'app-domain')).toBe('pass');
    expect(report.checks.find((c) => c.id === 'app-domain')!.detail).toMatch(/proxied/i);
  });
});

describe('domains', () => {
  it('fails when the app domain points somewhere else or nowhere', async () => {
    const elsewhere = { ...good, a: { ...good.a, 'tv.example.org': ['198.51.100.7'] } };
    expect(status(await runDnsCheck(config, fake(elsewhere)), 'app-domain')).toBe('fail');
    const missing = { ...good, a: { 'media.example.org': ['104.18.2.3'] } };
    const report = await runDnsCheck(config, fake(missing));
    expect(status(report, 'app-domain')).toBe('fail');
    expect(report.ok).toBe(false);
  });

  it('fails when the media domain points at the VPS, because media must serve from R2 only', async () => {
    const zone = { ...good, a: { ...good.a, 'media.example.org': ['203.0.113.10'] } };
    const report = await runDnsCheck(config, fake(zone));
    expect(status(report, 'media-domain')).toBe('fail');
    expect(report.checks.find((c) => c.id === 'media-domain')!.detail).toMatch(/R2/);
  });

  it('fails when the media domain does not resolve to Cloudflare', async () => {
    const zone = { ...good, a: { ...good.a, 'media.example.org': ['198.51.100.7'] } };
    expect(status(await runDnsCheck(config, fake(zone)), 'media-domain')).toBe('fail');
  });

  it('skips the VPS comparison with a warning when no address was given', async () => {
    const report = await runDnsCheck({ ...config, vpsIp: undefined }, fake(good));
    expect(status(report, 'app-domain')).toBe('warn');
  });

  it('treats a lookup error that is not "no record" as a failure with plain words', async () => {
    const zone = { ...good, fail: { 'A:tv.example.org': 'ETIMEOUT' } };
    const report = await runDnsCheck(config, fake(zone));
    expect(status(report, 'app-domain')).toBe('fail');
    expect(report.checks.find((c) => c.id === 'app-domain')!.detail).toMatch(/try again/i);
  });
});

describe('SPF', () => {
  const spf = (...records: string[]): Zone => ({
    ...good,
    txt: { ...good.txt, 'example.org': records },
  });

  it('fails when there is no SPF record, or two', async () => {
    expect(
      status(await runDnsCheck(config, fake(spf('google-site-verification=abc'))), 'spf'),
    ).toBe('fail');
    expect(status(await runDnsCheck(config, fake(spf('v=spf1 -all', 'v=spf1 ~all'))), 'spf')).toBe(
      'fail',
    );
  });

  it('fails an open policy and warns on a neutral one', async () => {
    expect(status(await runDnsCheck(config, fake(spf('v=spf1 include:a.test +all'))), 'spf')).toBe(
      'fail',
    );
    expect(status(await runDnsCheck(config, fake(spf('v=spf1 include:a.test ?all'))), 'spf')).toBe(
      'warn',
    );
    expect(status(await runDnsCheck(config, fake(spf('v=spf1 include:a.test'))), 'spf')).toBe(
      'warn',
    );
    expect(status(await runDnsCheck(config, fake(spf('v=spf1 include:a.test ~all'))), 'spf')).toBe(
      'pass',
    );
  });

  it('requires the provider include when one is configured', async () => {
    const withInclude = { ...config, spfInclude: '_spf.mail.test' };
    expect(status(await runDnsCheck(withInclude, fake(good)), 'spf')).toBe('pass');
    expect(
      status(await runDnsCheck({ ...config, spfInclude: '_spf.other.test' }, fake(good)), 'spf'),
    ).toBe('fail');
  });

  it('fails when the record needs more than 10 lookups', async () => {
    const many = `v=spf1 ${Array.from({ length: 11 }, (_, i) => `include:s${i}.test`).join(' ')} -all`;
    const report = await runDnsCheck(config, fake(spf(many)));
    expect(status(report, 'spf')).toBe('fail');
    expect(report.checks.find((c) => c.id === 'spf')!.detail).toMatch(/10/);
  });
});

describe('DKIM', () => {
  const dkim = (value: string[] | undefined, cname?: string[]): Zone => ({
    ...good,
    txt: { ...good.txt, ...(value ? { 's1._domainkey.example.org': value } : {}) },
    ...(!value
      ? { txt: Object.fromEntries(Object.entries(good.txt!).filter(([k]) => !k.startsWith('s1.'))) }
      : {}),
    cname: cname ? { 's1._domainkey.example.org': cname } : undefined,
  });

  it('fails with no record, and with a revoked key (empty p)', async () => {
    expect(status(await runDnsCheck(config, fake(dkim(undefined))), 'dkim:s1')).toBe('fail');
    expect(status(await runDnsCheck(config, fake(dkim(['v=DKIM1; p=']))), 'dkim:s1')).toBe('fail');
  });

  it('accepts a CNAME to the provider, which is how most providers publish keys', async () => {
    const report = await runDnsCheck(config, fake(dkim(undefined, ['s1.dkim.provider.test'])));
    expect(status(report, 'dkim:s1')).toBe('pass');
  });

  it('checks every selector and asks for one when none is given', async () => {
    const two = await runDnsCheck({ ...config, dkimSelectors: ['s1', 's2'] }, fake(good));
    expect(two.checks.filter((c) => c.id.startsWith('dkim:')).map((c) => [c.id, c.status])).toEqual(
      [
        ['dkim:s1', 'pass'],
        ['dkim:s2', 'fail'],
      ],
    );
    const none = await runDnsCheck({ ...config, dkimSelectors: [] }, fake(good));
    expect(status(none, 'dkim')).toBe('warn');
    expect(none.ok).toBe(true);
  });
});

describe('DMARC', () => {
  const dmarc = (...records: string[]): Zone => ({
    ...good,
    txt: { ...good.txt, '_dmarc.example.org': records },
  });

  it('fails with no record or two', async () => {
    const none = { ...good, txt: { ...good.txt } };
    delete none.txt!['_dmarc.example.org'];
    expect(status(await runDnsCheck(config, fake(none)), 'dmarc')).toBe('fail');
    expect(
      status(
        await runDnsCheck(config, fake(dmarc('v=DMARC1; p=none', 'v=DMARC1; p=reject'))),
        'dmarc',
      ),
    ).toBe('fail');
  });

  it('warns on p=none and passes quarantine and reject', async () => {
    expect(
      status(
        await runDnsCheck(config, fake(dmarc('v=DMARC1; p=none; rua=mailto:a@example.org'))),
        'dmarc',
      ),
    ).toBe('warn');
    expect(
      status(
        await runDnsCheck(config, fake(dmarc('v=DMARC1; p=reject; rua=mailto:a@example.org'))),
        'dmarc',
      ),
    ).toBe('pass');
  });

  it('warns when there is no report address', async () => {
    expect(status(await runDnsCheck(config, fake(dmarc('v=DMARC1; p=quarantine'))), 'dmarc')).toBe(
      'warn',
    );
  });

  it('fails a record with no valid policy', async () => {
    expect(
      status(await runDnsCheck(config, fake(dmarc('v=DMARC1; rua=mailto:a@example.org'))), 'dmarc'),
    ).toBe('fail');
    expect(status(await runDnsCheck(config, fake(dmarc('v=DMARC1; p=maybe'))), 'dmarc')).toBe(
      'fail',
    );
  });

  it('falls back to the parent domain for a sending subdomain, as receivers do', async () => {
    const zone: Zone = {
      ...good,
      txt: {
        ...good.txt,
        'mail.example.org': ['v=spf1 include:_spf.mail.test -all'],
        's1._domainkey.mail.example.org': ['v=DKIM1; p=abc'],
        '_dmarc.example.org': ['v=DMARC1; p=reject; rua=mailto:a@example.org'],
      },
    };
    const report = await runDnsCheck({ ...config, fromDomain: 'mail.example.org' }, fake(zone));
    expect(status(report, 'dmarc')).toBe('pass');
  });
});

describe('DMARC parent lookup', () => {
  it('does not ask a country suffix such as com.ng for a policy', async () => {
    const asked: string[] = [];
    const resolver: DnsResolver = {
      resolve4: async () => ['203.0.113.10'],
      resolveCname: async () => [],
      resolveTxt: async (name) => {
        asked.push(name);
        throw Object.assign(new Error('none'), { code: 'ENODATA' });
      },
    };
    await runDnsCheck({ ...config, fromDomain: 'example.com.ng' }, resolver);
    expect(asked).toContain('_dmarc.example.com.ng');
    expect(asked).not.toContain('_dmarc.com.ng');
  });
});

describe('report', () => {
  it('never contains more than names and plain words, and ok follows the failures', async () => {
    const report = await runDnsCheck(config, fake({}));
    expect(report.ok).toBe(false);
    expect(report.checks.every((c) => c.detail.length > 0 && !/[\u2013\u2014]/.test(c.detail))).toBe(true);
  });
});
