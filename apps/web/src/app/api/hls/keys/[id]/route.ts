import { one, videoRoute } from '@/server/video/route';

export const dynamic = 'force-dynamic';

export const GET = videoRoute('/api/hls/keys/[id]', (api, req, p) =>
  api.play.key(req, one(p, 'id')),
);
