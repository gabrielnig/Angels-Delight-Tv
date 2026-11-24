import { viewerRoute } from '../../../../server/viewer/route';

export const dynamic = 'force-dynamic';

export const GET = viewerRoute('/api/account/notifications', (api) => api.notificationPrefs.get);
export const PUT = viewerRoute('/api/account/notifications', (api) => api.notificationPrefs.set);
