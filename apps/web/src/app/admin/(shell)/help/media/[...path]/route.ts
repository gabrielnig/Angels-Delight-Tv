import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { findContentDir } from '@ad/help/node';
import { getActor } from '@/lib/data/admin/session-next';
import { resolveHelpImage } from '@/server/help/media';
import { helpMediaRelease, openVideoSource } from '@/server/help/sources';
import { resolveVideoSource, serveVideo, videoFileType } from '@/server/help/video';

export const dynamic = 'force-dynamic';

const HEADERS = {
  'cache-control': 'private, max-age=3600',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex, nofollow',
};

/**
 * Private files for the help centre (M50-S07). Only signed in staff get anything. Pictures live in the repo
 * (img/...). Video files (video/<id>/<file>) come from the media release. Anything else is a 404, a path never leaves its folder.
 */
export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
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
  if (kind === 'video' && rest.length === 2) {
    const [videoId, name] = rest as [string, string];
    const type = videoFileType(videoId, name);
    if (type) {
      try {
        const file = await openVideoSource(resolveVideoSource(helpMediaRelease(), videoId, name));
        if (file) return serveVideo(file, type, request.headers.get('range'), HEADERS);
      } catch {
        return new Response('The file could not be read. Try again.', {
          status: 502,
          headers: HEADERS,
        });
      }
    }
  }
  return new Response('Not found.', { status: 404, headers: HEADERS });
}
