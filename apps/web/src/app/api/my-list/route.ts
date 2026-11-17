import { viewerRoute } from '../../../server/viewer/route';

export const dynamic = 'force-dynamic';

export const GET = viewerRoute('/api/my-list', (api) => api.myList.list);
export const POST = viewerRoute('/api/my-list', (api) => api.myList.add);
export const DELETE = viewerRoute('/api/my-list', (api) => api.myList.remove);
