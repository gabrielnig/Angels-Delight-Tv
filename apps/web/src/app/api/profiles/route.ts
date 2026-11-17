import { viewerRoute } from '../../../server/viewer/route';

export const dynamic = 'force-dynamic';

export const GET = viewerRoute('/api/profiles', (api) => api.profiles.list);
export const POST = viewerRoute('/api/profiles', (api) => api.profiles.create);
