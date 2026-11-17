import { viewerRoute } from '../../../../server/viewer/route';

export const dynamic = 'force-dynamic';

export const GET = viewerRoute('/api/browse/categories', (api) => api.categories);
