/**
 * DNS and email authentication check for launch (M21-S04). Every lookup goes through an injected resolver, so the tests
 * run offline and the command line uses the real one. Nothing here prints more than names and plain words.
 */
export interface DnsResolver {
  /** IPv4 addresses. */
  resolve4(name: string): Promise<string[]>;
  /** TXT records, each already joined from its chunks. */
  resolveTxt(name: string): Promise<string[]>;
  resolveCname(name: string): Promise<string[]>;
}

export interface DnsConfig {
  appDomain: string;
  /** The R2 custom domain that serves media. */
  mediaDomain: string;
  /** The domain in EMAIL_FROM. */
  fromDomain: string;
  /** The VPS address. Without it the app domain cannot be compared. */
  vpsIp?: string;
  /** Selectors from the email provider. */
  dkimSelectors: string[];
  /** For example `_spf.provider.example`. When set, the SPF record must include it. */
  spfInclude?: string;
  /** True when SMTP_URL is the word disabled. Always a launch blocker. */
  emailDisabled?: boolean;
  /** Addresses Cloudflare answers with when a name is proxied. Defaults to the published list. */
  cloudflareRanges?: string[];
}

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface DnsCheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface DnsReport {
  /** False when any check failed. Warnings do not fail the report. */
  ok: boolean;
  checks: DnsCheckResult[];
}

/** Cloudflare's published IPv4 ranges (https://www.cloudflare.com/ips-v4). Pass `cloudflareRanges` to override. */
export const CLOUDFLARE_IPV4_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
];

function toInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;
    value = value * 256 + Number(part);
  }
  return value;
}

export function inRanges(ip: string, ranges: string[]): boolean {
  const value = toInt(ip);
  if (value === null) return false;
  return ranges.some((range) => {
    const [base, bits] = range.split('/');
    const start = toInt(base ?? '');
    const size = Number(bits);
    if (start === null || !Number.isInteger(size) || size < 0 || size > 32) return false;
    const span = 2 ** (32 - size);
    return value >= start && value < start + span;
  });
}

type Lookup<T> = { kind: 'ok'; value: T } | { kind: 'none' } | { kind: 'error' };

const MISSING = new Set(['ENODATA', 'ENOTFOUND', 'ENOENT', 'NXDOMAIN', 'NOTFOUND']);

/** "No such record" is an answer; a timeout or refusal is not, and must not read as a missing record. */
async function lookup<T extends unknown[]>(run: () => Promise<T>): Promise<Lookup<T>> {
  try {
    const value = await run();
    return value.length === 0 ? { kind: 'none' } : { kind: 'ok', value };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    return code && MISSING.has(code) ? { kind: 'none' } : { kind: 'error' };
  }
}

const RETRY = 'The lookup did not finish. Check the network and try again.';

function result(id: string, label: string, status: CheckStatus, detail: string): DnsCheckResult {
  return { id, label, status, detail };
}

async function checkAddress(
  resolver: DnsResolver,
  id: string,
  label: string,
  name: string,
  config: DnsConfig,
  missing: CheckStatus,
): Promise<DnsCheckResult> {
  const found = await lookup(() => resolver.resolve4(name));
  if (found.kind === 'error') return result(id, label, 'fail', `${name}: ${RETRY}`);
  if (found.kind === 'none')
    return result(id, label, missing, `${name} has no A record. Add one that points at the VPS.`);
  const ranges = config.cloudflareRanges ?? CLOUDFLARE_IPV4_RANGES;
  const addresses = found.value;
  if (!config.vpsIp)
    return result(
      id,
      label,
      'warn',
      `${name} resolves, but no VPS address was given to compare with. Pass --vps-ip.`,
    );
  if (addresses.includes(config.vpsIp))
    return result(id, label, 'pass', `${name} points at the VPS (${config.vpsIp}).`);
  if (addresses.every((address) => inRanges(address, ranges)))
    return result(
      id,
      label,
      'pass',
      `${name} is proxied by Cloudflare. DNS cannot show the VPS address behind the proxy, so confirm it in the dashboard.`,
    );
  return result(
    id,
    label,
    'fail',
    `${name} resolves to ${addresses.join(', ')}, which is neither the VPS (${config.vpsIp}) nor Cloudflare.`,
  );
}

async function checkMedia(resolver: DnsResolver, config: DnsConfig): Promise<DnsCheckResult> {
  const id = 'media-domain';
  const label = 'Media domain points at R2';
  const name = config.mediaDomain;
  const found = await lookup(() => resolver.resolve4(name));
  if (found.kind === 'error') return result(id, label, 'fail', `${name}: ${RETRY}`);
  if (found.kind === 'none')
    return result(
      id,
      label,
      'fail',
      `${name} has no record. Attach it as the custom domain of the ad-media R2 bucket.`,
    );
  if (config.vpsIp && found.value.includes(config.vpsIp))
    return result(
      id,
      label,
      'fail',
      `${name} points at the VPS. Media must serve from R2 only, so attach it as the R2 custom domain instead.`,
    );
  const ranges = config.cloudflareRanges ?? CLOUDFLARE_IPV4_RANGES;
  if (!found.value.every((address) => inRanges(address, ranges)))
    return result(
      id,
      label,
      'fail',
      `${name} resolves to ${found.value.join(', ')}, which is not Cloudflare. Attach it as the R2 custom domain.`,
    );
  return result(id, label, 'pass', `${name} is served by Cloudflare, as an R2 custom domain is.`);
}

async function txtRecords(resolver: DnsResolver, name: string): Promise<Lookup<string[]>> {
  return lookup(() => resolver.resolveTxt(name));
}

const LOOKUP_MECHANISM = /^[+\-~?]?(include:|a$|a:|a\/|mx$|mx:|mx\/|ptr$|ptr:|exists:)|^redirect=/i;

async function checkSpf(resolver: DnsResolver, config: DnsConfig): Promise<DnsCheckResult> {
  const id = 'spf';
  const label = 'SPF record';
  const domain = config.fromDomain;
  const found = await txtRecords(resolver, domain);
  if (found.kind === 'error') return result(id, label, 'fail', `${domain}: ${RETRY}`);
  const records = found.kind === 'ok' ? found.value.filter((r) => /^v=spf1(\s|$)/i.test(r)) : [];
  if (records.length === 0)
    return result(
      id,
      label,
      'fail',
      `${domain} has no SPF record. Add the one your email provider gives you.`,
    );
  if (records.length > 1)
    return result(
      id,
      label,
      'fail',
      `${domain} has ${records.length} SPF records. Keep one and merge the rest into it.`,
    );
  const terms = records[0]!.trim().split(/\s+/).slice(1);
  const lookups = terms.filter((term) => LOOKUP_MECHANISM.test(term)).length;
  if (lookups > 10)
    return result(
      id,
      label,
      'fail',
      `The SPF record needs ${lookups} lookups and the limit is 10. Remove an include.`,
    );
  if (
    config.spfInclude &&
    !terms.some((t) => t.toLowerCase() === `include:${config.spfInclude!.toLowerCase()}`)
  )
    return result(
      id,
      label,
      'fail',
      `The SPF record does not include ${config.spfInclude}, which your email provider needs.`,
    );
  const all = terms.find((term) => /^[+\-~?]?all$/i.test(term));
  if (!all)
    return result(
      id,
      label,
      'warn',
      'The SPF record has no "all" at the end, so it does not say what to do with other senders. End it with ~all or -all.',
    );
  const qualifier = all.length === 3 ? '+' : all[0]!;
  if (qualifier === '+')
    return result(
      id,
      label,
      'fail',
      'The SPF record ends with +all, which lets anyone send as your domain. Use ~all or -all.',
    );
  if (qualifier === '?')
    return result(
      id,
      label,
      'warn',
      'The SPF record ends with ?all, which says nothing about other senders. Use ~all or -all.',
    );
  return result(id, label, 'pass', `SPF is set with ${qualifier}all and ${lookups} of 10 lookups.`);
}

async function checkDkim(
  resolver: DnsResolver,
  config: DnsConfig,
  selector: string,
): Promise<DnsCheckResult> {
  const id = `dkim:${selector}`;
  const label = `DKIM key ${selector}`;
  const name = `${selector}._domainkey.${config.fromDomain}`;
  const found = await txtRecords(resolver, name);
  if (found.kind === 'error') return result(id, label, 'fail', `${name}: ${RETRY}`);
  if (found.kind === 'ok') {
    const record = found.value.find((r) => /(^|;)\s*p=/i.test(r));
    if (!record)
      return result(
        id,
        label,
        'fail',
        `${name} has a TXT record but no public key (p=). Copy it again from your email provider.`,
      );
    const key = /(^|;)\s*p=([^;]*)/i.exec(record)?.[2]?.trim() ?? '';
    if (key === '')
      return result(
        id,
        label,
        'fail',
        `${name} has an empty key, which means it was revoked. Publish the current key.`,
      );
    return result(id, label, 'pass', `${name} publishes a key.`);
  }
  const cname = await lookup(() => resolver.resolveCname(name));
  if (cname.kind === 'ok')
    return result(
      id,
      label,
      'pass',
      `${name} points at ${cname.value[0]}, which is how your provider publishes the key.`,
    );
  if (cname.kind === 'error') return result(id, label, 'fail', `${name}: ${RETRY}`);
  return result(
    id,
    label,
    'fail',
    `${name} has no record. Add the DKIM record from your email provider.`,
  );
}

/** Receivers fall back to the parent domain. A suffix such as `com.ng` is never a parent worth asking. */
const TWO_LEVEL_SUFFIX = /^(com|org|net|gov|edu|co|ac)\.[a-z]{2}$/i;

function dmarcCandidates(domain: string): string[] {
  const labels = domain.split('.');
  if (labels.length < 3) return [domain];
  const parent = labels.slice(1).join('.');
  return TWO_LEVEL_SUFFIX.test(parent) ? [domain] : [domain, parent];
}

async function checkDmarc(resolver: DnsResolver, config: DnsConfig): Promise<DnsCheckResult> {
  const id = 'dmarc';
  const label = 'DMARC policy';
  for (const domain of dmarcCandidates(config.fromDomain)) {
    const name = `_dmarc.${domain}`;
    const found = await txtRecords(resolver, name);
    if (found.kind === 'error') return result(id, label, 'fail', `${name}: ${RETRY}`);
    if (found.kind === 'none') continue;
    const records = found.value.filter((r) => /^v=DMARC1\s*(;|$)/i.test(r.trim()));
    if (records.length === 0) continue;
    if (records.length > 1)
      return result(id, label, 'fail', `${name} has ${records.length} DMARC records. Keep one.`);
    const tags = new Map(
      records[0]!
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const [key = '', ...rest] = part.split('=');
          return [key.trim().toLowerCase(), rest.join('=').trim()] as const;
        }),
    );
    const policy = (tags.get('p') ?? '').toLowerCase();
    const where = domain === config.fromDomain ? '' : ` (inherited from ${domain})`;
    if (!['none', 'quarantine', 'reject'].includes(policy))
      return result(
        id,
        label,
        'fail',
        `${name} has no valid policy. Set p=none, p=quarantine or p=reject.`,
      );
    if (policy === 'none')
      return result(
        id,
        label,
        'warn',
        `DMARC is in monitoring mode (p=none)${where}. Move to quarantine once reports look clean.`,
      );
    if (!tags.get('rua'))
      return result(
        id,
        label,
        'warn',
        `DMARC is p=${policy}${where} but has no report address (rua=). Add one to see who sends as you.`,
      );
    return result(id, label, 'pass', `DMARC is p=${policy}${where} with reports on.`);
  }
  return result(
    id,
    label,
    'fail',
    `${config.fromDomain} has no DMARC record. Add one at _dmarc.${config.fromDomain}, starting with p=none.`,
  );
}

export async function runDnsCheck(config: DnsConfig, resolver: DnsResolver): Promise<DnsReport> {
  const checks: DnsCheckResult[] = [];
  checks.push(
    await checkAddress(
      resolver,
      'app-domain',
      'App domain points at the VPS',
      config.appDomain,
      config,
      'fail',
    ),
  );
  checks.push(
    await checkAddress(
      resolver,
      'app-www',
      'www points at the VPS',
      `www.${config.appDomain}`,
      config,
      'warn',
    ),
  );
  checks.push(await checkMedia(resolver, config));
  if (config.emailDisabled) {
    checks.push(
      result(
        'email-configured',
        'Email sending is configured',
        'fail',
        'Email is not configured: SMTP_URL is set to disabled, so sign up verification and password reset cannot reach anyone. Set a real SMTP_URL and redeploy before launch.',
      ),
    );
    return { ok: false, checks };
  }
  checks.push(await checkSpf(resolver, config));
  if (config.dkimSelectors.length === 0) {
    checks.push(
      result(
        'dkim',
        'DKIM key',
        'warn',
        'No DKIM selector was given, so DKIM was not checked. Pass --dkim-selector with the selector from your email provider.',
      ),
    );
  } else {
    for (const selector of config.dkimSelectors)
      checks.push(await checkDkim(resolver, config, selector));
  }
  checks.push(await checkDmarc(resolver, config));
  return { ok: checks.every((check) => check.status !== 'fail'), checks };
}

/** `Name <a@b.org>` or `a@b.org` gives `b.org`. Used to find the sending domain from EMAIL_FROM. */
export function domainOfAddress(value: string | undefined): string | undefined {
  const match = /@([a-z0-9.-]+)>?\s*$/i.exec(value?.trim() ?? '');
  return match?.[1]?.toLowerCase();
}
