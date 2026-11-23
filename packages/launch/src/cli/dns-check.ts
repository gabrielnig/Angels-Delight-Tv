import { domainOfAddress, runDnsCheck, type DnsConfig } from '../dns/check';
import { nodeResolver } from '../dns/resolver';
import { parseArgs } from './args';

const USAGE = `Usage: pnpm dns:check [--vps-ip <address>] [--dkim-selector <a,b>] [--spf-include <name>] [--json]
       [--app-domain <name>] [--media-domain <name>] [--from-domain <name>] [--dns-server <ip>]
Checks that the app domain points at the VPS, the media domain is the R2 custom domain, and that SPF, DKIM and DMARC
are set for the sending domain. Domains default to APP_DOMAIN, MEDIA_DOMAIN and the domain in EMAIL_FROM.
SMTP_URL=disabled (no email yet) always fails this check.
Exit code 0 when nothing failed (warnings are shown), 1 when a check failed, 2 for bad input.`;

const MARK = { pass: 'PASS', warn: 'WARN', fail: 'FAIL' } as const;

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2), {
    values: [
      'vps-ip',
      'dkim-selector',
      'spf-include',
      'app-domain',
      'media-domain',
      'from-domain',
      'dns-server',
    ],
    booleans: ['json'],
  });
  if (!parsed.ok) {
    console.error(parsed.error);
    console.error(USAGE);
    return 2;
  }
  const v = parsed.values;
  const appDomain = (v['app-domain'] ?? process.env.APP_DOMAIN ?? '').trim().toLowerCase();
  const mediaDomain = (v['media-domain'] ?? process.env.MEDIA_DOMAIN ?? '').trim().toLowerCase();
  const fromDomain = (v['from-domain'] ?? domainOfAddress(process.env.EMAIL_FROM) ?? '')
    .trim()
    .toLowerCase();
  const emailDisabled = (process.env.SMTP_URL ?? '').trim().toLowerCase() === 'disabled';
  const missing = [
    appDomain ? null : 'APP_DOMAIN (or --app-domain)',
    mediaDomain ? null : 'MEDIA_DOMAIN (or --media-domain)',
    fromDomain || emailDisabled ? null : 'EMAIL_FROM (or --from-domain)',
  ].filter(Boolean);
  if (missing.length > 0) {
    console.error(`Missing: ${missing.join(', ')}`);
    console.error(USAGE);
    return 2;
  }
  const config: DnsConfig = {
    appDomain,
    mediaDomain,
    fromDomain,
    emailDisabled,
    vpsIp: v['vps-ip'],
    dkimSelectors: (v['dkim-selector'] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    spfInclude: v['spf-include'],
  };
  const report = await runDnsCheck(config, nodeResolver(v['dns-server']?.split(',')));
  if (parsed.flags.json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const check of report.checks)
      console.log(`${MARK[check.status]}  ${check.label}: ${check.detail}`);
    console.log(report.ok ? '\nNo failures.' : '\nFix the failures above, then run this again.');
  }
  return report.ok ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : 'The DNS check failed');
    process.exit(1);
  },
);
