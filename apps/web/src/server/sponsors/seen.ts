import { isSponsorSlot } from '@ad/shared';
import {
  capCookieName,
  capCookieOptions,
  isGeneralAudience,
  lagosDayNumber,
  parseCapCookie,
  recordImpression,
  serializeCapCookie,
} from '@ad/sponsors';
import type { ViewerContext } from '../../lib/analytics/handler';

export interface SeenDeps {
  resolveViewer(request: Request): Promise<ViewerContext>;
  now?: () => Date;
  secure: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_BODY = 512;
const done = (headers: Record<string, string> = {}) =>
  new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', ...headers } });

function readCookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

/**
 * POST /api/sponsors/seen. The browser reports a viewable impression so the server can count it against the day
 * or session cap in an httpOnly cookie that holds creative ids and counts only. Kids, an unknown audience, an
 * unresolved viewer and bad input all answer 204 and set nothing.
 */
export function createSeenHandler(deps: SeenDeps) {
  return async (request: Request): Promise<Response> => {
    let viewer: ViewerContext;
    try {
      viewer = await deps.resolveViewer(request);
    } catch {
      return done();
    }
    if (!isGeneralAudience(viewer.audience)) return done();

    const text = await request.text().catch(() => '');
    if (text.length === 0 || text.length > MAX_BODY) return done();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return done();
    }
    const { creativeId, slot } = (body ?? {}) as { creativeId?: unknown; slot?: unknown };
    if (typeof creativeId !== 'string' || !UUID.test(creativeId) || !isSponsorSlot(slot))
      return done();

    const today = lagosDayNumber((deps.now ?? (() => new Date()))());
    const name = capCookieName(slot);
    const map = recordImpression(
      parseCapCookie(readCookie(request.headers.get('cookie'), name), today),
      creativeId,
      slot,
      today,
    );
    const o = capCookieOptions(slot, deps.secure);
    const attrs = [
      `${name}=${serializeCapCookie(map)}`,
      `Path=${o.path}`,
      'HttpOnly',
      `SameSite=Lax`,
    ];
    if (o.secure) attrs.push('Secure');
    if (o.maxAge !== undefined) attrs.push(`Max-Age=${o.maxAge}`);
    return done({ 'Set-Cookie': attrs.join('; ') });
  };
}
