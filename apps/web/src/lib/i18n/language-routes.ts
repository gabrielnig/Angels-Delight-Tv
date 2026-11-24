import { Forbidden, RateLimited, ValidationFailed, type Actor } from '@ad/shared';
import { IMPORT_MAX_BYTES, ImportRefused, type TranslationService } from '@ad/i18n';
import { localeInfo } from '@ad/shared/messages';
import { sameOriginOr403 } from '../../server/auth/request';

export interface LanguageRouteDeps {
  getActor(): Promise<Actor | null>;
  service(actor: Actor): TranslationService | Promise<TranslationService>;
  appOrigin: string;
  spend(actor: Actor): Promise<void>;
}

const text = (body: string, status: number, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'cache-control': 'no-store', ...extra } });

/** Export and import for one language (M46-S12). Staff only, same origin, no caching, 2 MB cap. */
export function createLanguageHandlers(deps: LanguageRouteDeps) {
  type Guard = { response: Response; actor?: undefined } | { actor: Actor; response?: undefined };
  async function guard(locale: string): Promise<Guard> {
    const info = localeInfo(locale);
    if (!info || info.source) return { response: text('Not found', 404) };
    const actor = await deps.getActor();
    if (!actor) return { response: text('Sign in first.', 401) };
    try {
      await deps.spend(actor);
    } catch (error) {
      if (error instanceof RateLimited)
        return { response: text('Too many requests.', 429, { 'retry-after': String(error.retryAfterSeconds) }) };
      throw error;
    }
    return { actor };
  }

  const fail = (error: unknown) => {
    if (error instanceof Forbidden) return text('You do not have permission to do this.', 403);
    if (error instanceof ImportRefused || error instanceof ValidationFailed) return text(error.message, 422);
    throw error;
  };

  return {
    async exportFile(request: Request, locale: string): Promise<Response> {
      const g = await guard(locale);
      if (g.response) return g.response;
      const actor = g.actor;
      const format = new URL(request.url).searchParams.get('format') === 'json' ? 'json' : 'csv';
      try {
        const service = await deps.service(actor);
        const stamp = new Date().toISOString().slice(0, 10);
        if (format === 'json') {
          return text(await service.exportJson(actor, locale), 200, {
            'content-type': 'application/json; charset=utf-8',
            'content-disposition': `attachment; filename="${locale}-${stamp}.json"`,
          });
        }
        return text(await service.exportCsv(actor, locale), 200, {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${locale}-${stamp}.csv"`,
        });
      } catch (error) {
        return fail(error);
      }
    },

    async importCsv(request: Request, locale: string): Promise<Response> {
      const refused = sameOriginOr403(request.headers, deps.appOrigin);
      if (refused) return refused;
      const g = await guard(locale);
      if (g.response) return g.response;
      const actor = g.actor;
      const length = Number(request.headers.get('content-length') ?? 0);
      if (length > IMPORT_MAX_BYTES) return text('The file is over 2 MB.', 413);
      const body = await request.text();
      if (new TextEncoder().encode(body).length > IMPORT_MAX_BYTES) return text('The file is over 2 MB.', 413);
      const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
      try {
        const plan = await (await deps.service(actor)).importCsv(actor, locale, body, { dryRun });
        return new Response(JSON.stringify({ dryRun, ...plan, writes: undefined, written: dryRun ? 0 : plan.writes.length }), {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        });
      } catch (error) {
        return fail(error);
      }
    },
  };
}
