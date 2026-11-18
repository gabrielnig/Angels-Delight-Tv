/**
 * Deploy smoke test for the media origin (M22-S01 and M31-S03 error cases). Run it after each deploy and after any
 * Cloudflare change. It needs no secret: it proves CORS is limited to the app origin and that segments are not
 * served without a valid signature, the two things a CDN misconfiguration breaks.
 */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface SmokeTarget {
  mediaOrigin: string;
  appOrigin: string;
}

export interface SmokeResult {
  name: string;
  ok: boolean;
  detail: string;
}

const OTHER_ORIGIN = 'https://not-the-app.invalid';
const SEGMENT = 'v/smoke-check/360p/seg00000.ts';

async function check(name: string, run: () => Promise<string | null>): Promise<SmokeResult> {
  try {
    const problem = await run();
    return { name, ok: problem === null, detail: problem ?? 'ok' };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

export async function edgeSmoke(
  target: SmokeTarget,
  fetchFn: FetchLike = (url, init) => fetch(url, init),
): Promise<SmokeResult[]> {
  const base = target.mediaOrigin.replace(/\/$/, '');
  const preflight = (origin: string) =>
    fetchFn(`${base}/${SEGMENT}`, { method: 'OPTIONS', headers: { origin } });

  return [
    await check('cors allows the app origin', async () => {
      const allowed = (await preflight(target.appOrigin)).headers.get(
        'access-control-allow-origin',
      );
      return allowed === target.appOrigin ? null : `answered ${allowed ?? 'no header'}`;
    }),
    await check('cors refuses another origin', async () => {
      const allowed = (await preflight(OTHER_ORIGIN)).headers.get('access-control-allow-origin');
      return allowed === null ? null : `allowed ${allowed}`;
    }),
    await check('cors is not a wildcard', async () => {
      const res = await fetchFn(`${base}/${SEGMENT}`, { headers: { origin: target.appOrigin } });
      return res.headers.get('access-control-allow-origin') === '*' ? 'answered *' : null;
    }),
    await check('unsigned segment is refused', async () => {
      const { status } = await fetchFn(`${base}/${SEGMENT}`);
      return status === 403 ? null : `answered ${status}, expected 403`;
    }),
    await check('badly signed segment is refused', async () => {
      const exp = Math.floor(Date.now() / 1000) + 600;
      const { status } = await fetchFn(
        `${base}/${SEGMENT}?exp=${exp}&sig=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
      );
      return status === 403 ? null : `answered ${status}, expected 403`;
    }),
  ];
}
