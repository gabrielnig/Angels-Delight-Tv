/**
 * The recorder only ever points at a local demo stack. A recording shows whatever the target serves, so a real
 * origin or database must be impossible to reach by mistake (plan section 11.1, M50-S13 AC2).
 */
type Env = Record<string, string | undefined>;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const RESERVED = /(?:^|\.)example\.(?:com|net|org|test)$|\.invalid$|\.test$/i;
const ALLOWED_DATABASES = new Set(['ad_kb', 'ad_kb_keys']);

export function assertAllowedOrigin(raw: string, o: { env?: Env } = {}): void {
  const env = o.env ?? process.env;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`The recorder refuses "${raw}": not a valid URL`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`The recorder refuses "${raw}": only http and https`);
  }
  if (url.username || url.password) {
    throw new Error(`The recorder refuses "${raw}": no credentials in the address`);
  }
  if (LOCAL_HOSTS.has(url.hostname)) return;
  const demoHost = env.KB_DEMO_HOST?.trim().toLowerCase();
  if (demoHost && RESERVED.test(demoHost) && url.hostname === demoHost) return;
  throw new Error(
    `The recorder refuses "${url.origin}": it records only localhost or the demo host (KB_DEMO_HOST, a reserved example name)`,
  );
}

/** Real Postgres mode: only the databases `ad_kb` and `ad_kb_keys` on this machine. */
export function assertAllowedDatabase(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('The recorder refuses a database address that is not a valid URL');
  }
  const name = url.pathname.replace(/^\//, '');
  if (!LOCAL_HOSTS.has(url.hostname) || !ALLOWED_DATABASES.has(name)) {
    throw new Error(
      `The recorder refuses database "${name}" on "${url.hostname}": only ad_kb and ad_kb_keys on localhost`,
    );
  }
}
