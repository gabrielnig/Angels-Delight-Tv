import { videoRoute } from '@/server/video/route';

export const dynamic = 'force-dynamic';

/** Development only, the local storage driver's stand in for presigned urls. Answers 404 when not mounted. */
const handle = videoRoute('/api/dev-storage', (api, req) => api.devStorage(req));
export const GET = handle;
export const PUT = handle;
