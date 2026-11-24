import type { Actor } from '@ad/shared';
import { errorResponse, json } from './http';

export interface GuestAudienceValue {
  kids: boolean;
  /** Highest maturity rank a guest may see (setting maturity.guest_max_rank). Absent means no limit. */
  maxRank?: number;
}

export interface PublicGuardDeps {
  /** The signed in account for this request, or null (same function the personal routes use). */
  resolveActor(request: Request): Promise<Actor | null>;
  /** The verified guest id from the signed cookie, or null. Browsing never mints one. */
  guestId(request: Request): string | null;
  /** The audience a guest sees: the device choice, else the site default. */
  audience(request: Request): Promise<GuestAudienceValue>;
  /** Client address after trusted proxy handling. */
  clientIp(request: Request): string;
  /** Spends one attempt and throws RateLimited when the bucket is empty. */
  spend(bucket: 'api' | 'search', subject: string): Promise<void>;
}

export type GuestHandler = (
  request: Request,
  params: Record<string, string>,
  audience: GuestAudienceValue,
) => Promise<Response>;

type PersonalHandler = (request: Request, params?: Record<string, string>) => Promise<Response>;

/**
 * Public GET authentication (M40, D-G11). One URL per resource: when a session exists the existing personal
 * handler runs untouched, otherwise the guest handler runs with the guest audience. GET and HEAD only. Guests are
 * limited per address and, when their cookie verifies, per guest id. Personal routes never use this: they keep the
 * 401 guard.
 */
export function createPublicGuard(deps: PublicGuardDeps) {
  return (personal: PersonalHandler, guest: GuestHandler, options: { search?: boolean } = {}) =>
    async (request: Request, params: Record<string, string> = {}): Promise<Response> => {
      const method = request.method.toUpperCase();
      if (method !== 'GET' && method !== 'HEAD') {
        return json(
          { error: { code: 'method_not_allowed', message: 'Method not allowed' } },
          { status: 405, headers: { Allow: 'GET, HEAD' } },
        );
      }
      try {
        const actor = await deps.resolveActor(request);
        if (actor) return await personal(request, params);
        const subjects = [`guest-ip:${deps.clientIp(request)}`];
        const id = deps.guestId(request);
        if (id) subjects.push(`guest:${id}`);
        const buckets: Array<'api' | 'search'> = options.search ? ['api', 'search'] : ['api'];
        for (const bucket of buckets)
          for (const subject of subjects) await deps.spend(bucket, subject);
        return await guest(request, params, await deps.audience(request));
      } catch (error) {
        const mapped = errorResponse(error);
        if (mapped) return mapped;
        throw error;
      }
    };
}
