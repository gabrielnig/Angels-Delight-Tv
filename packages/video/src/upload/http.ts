import { ValidationFailed, type Actor } from '@ad/shared';
import { errorResponse, jsonResponse, readJson } from '../http/respond';
import type { UploadService } from './service';

export interface UploadHttpDeps {
  service: Pick<UploadService, 'create' | 'describe' | 'presignParts' | 'complete' | 'abort'>;
  /** Resolves the signed in admin or editor, or throws Unauthorized. Owned by the auth lane. */
  getActor(request: Request): Promise<Actor>;
  /** CSRF same-origin check for writes (throws Forbidden). */
  assertSameOrigin?(request: Request): void;
  onUnexpected?(error: unknown, request: Request): void;
}

type Body = Record<string, unknown>;

/**
 * Handlers for the admin upload API in ARCHITECTURE section 7. They take a Request and return a Response, so
 * a Next route file is a one-line wrapper and the logic is testable without a server.
 */
export function createUploadHandlers(deps: UploadHttpDeps) {
  async function run(
    request: Request,
    write: boolean,
    fn: (actor: Actor) => Promise<Response>,
  ): Promise<Response> {
    try {
      if (write) deps.assertSameOrigin?.(request);
      const actor = await deps.getActor(request);
      return await fn(actor);
    } catch (error) {
      return errorResponse(error, (e) => deps.onUnexpected?.(e, request));
    }
  }

  return {
    create: (request: Request) =>
      run(request, true, async (actor) => {
        const body = (await readJson(request)) as Body;
        const result = await deps.service.create(
          actor,
          {
            name: body.name as string,
            size: body.size as number,
            type: body.type as string,
            fingerprint: body.fingerprint as string,
          },
          {
            replaceVideoId:
              typeof body.replaceVideoId === 'string' ? body.replaceVideoId : undefined,
          },
        );
        return jsonResponse(result, result.resumed ? 200 : 201);
      }),

    describe: (request: Request, uploadId: string) =>
      run(request, false, async (actor) =>
        jsonResponse(await deps.service.describe(actor, uploadId)),
      ),

    parts: (request: Request, uploadId: string) =>
      run(request, true, async (actor) => {
        const body = (await readJson(request)) as Body;
        const numbers = body.partNumbers;
        if (!Array.isArray(numbers) || !numbers.every((n) => Number.isInteger(n))) {
          throw new ValidationFailed({ partNumbers: ['Send a list of whole part numbers.'] });
        }
        const urls = await deps.service.presignParts(actor, uploadId, numbers as number[]);
        return jsonResponse({ urls });
      }),

    complete: (request: Request, uploadId: string) =>
      run(request, true, async (actor) =>
        jsonResponse(await deps.service.complete(actor, uploadId)),
      ),

    abort: (request: Request, uploadId: string) =>
      run(request, true, async (actor) => {
        await deps.service.abort(actor, uploadId);
        return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
      }),
  };
}
