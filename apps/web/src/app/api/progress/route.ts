import { viewerRoute } from '../../../server/viewer/route';

export const dynamic = 'force-dynamic';

export const GET = viewerRoute('/api/progress', (api) => api.progress.get);
export const POST = viewerRoute('/api/progress', (api) => api.progress.save);
export const DELETE = viewerRoute('/api/progress', (api) => api.progress.remove);
