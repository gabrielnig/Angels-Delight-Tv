import { viewerRoute } from '../../../server/viewer/route';

export const dynamic = 'force-dynamic';

export const GET = viewerRoute('/api/notices', (api) => api.notices.list);
export const POST = viewerRoute('/api/notices', (api) => api.notices.markRead);
