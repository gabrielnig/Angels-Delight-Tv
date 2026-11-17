import { one, videoRoute } from '@/server/video/route';

export const dynamic = 'force-dynamic';

/** master.m3u8 and {height}.m3u8. The handler answers 404 for any other name. */
export const GET = videoRoute('/api/play/[id]/[file]', (api, req, p) =>
  api.play.playlist(req, one(p, 'id'), one(p, 'file')),
);
