import { viewerRoute } from '../../../../server/viewer/route';

export const dynamic = 'force-dynamic';

export const GET = viewerRoute('/api/notices/count', (api) => api.notices.count);
