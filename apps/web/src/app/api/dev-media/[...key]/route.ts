import { one, videoRoute } from '@/server/video/route';

export const dynamic = 'force-dynamic';

/** Development only, stands in for the edge worker. Answers 404 when not mounted. */
const handle = videoRoute('/api/dev-media', (api, req, p) => api.devMedia(req, one(p, 'key')));
export const GET = handle;
export const HEAD = handle;
