import { viewerRoute } from '../../../server/viewer/route';

export const dynamic = 'force-dynamic';

export const GET = viewerRoute('/api/ratings', (api) => api.ratings.get);
export const PUT = viewerRoute('/api/ratings', (api) => api.ratings.set);
