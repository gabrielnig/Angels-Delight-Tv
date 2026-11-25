import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { findContentDir } from '@ad/help/node';
import { getActor } from '@/lib/data/admin/session-next';
import { resolveHelpImage } from '@/server/help/media';

export const dynamic = 'force-dynamic';

const HEADERS = {
  'cache-control': 'private, max-age=3600',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex, nofollow',
};

/**
 * Private files for the help centre (M50-S07). Only signed in staff get anything. Pictures live in the repo
 * (img/...). Video files are added in the video slice. Anything else is a 404, a path never leaves its folder.
 */
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const actor = await getActor();
  if (!actor) return new Response('Sign in first.', { status: 401, headers: HEADERS });
  const { path } = await context.params;
  const [kind, ...rest] = path;
  if (kind === 'img') {
    const hit = resolveHelpImage(findContentDir(), rest);
    if (hit) {
      return new Response(Readable.toWeb(createReadStream(hit.file)) as ReadableStream, {
        headers: { ...HEADERS, 'content-type': hit.contentType },
      });
    }
  }
  return new Response('Not found.', { status: 404, headers: HEADERS });
}
