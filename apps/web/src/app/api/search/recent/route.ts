import { viewerRoute } from '../../../../server/viewer/route';

export const dynamic = 'force-dynamic';

export const GET = viewerRoute('/api/search/recent', (api) => api.recentSearches.list);
export const DELETE = viewerRoute('/api/search/recent', (api) => api.recentSearches.remove);
