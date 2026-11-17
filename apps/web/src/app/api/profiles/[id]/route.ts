import { viewerRoute } from '../../../../server/viewer/route';

export const dynamic = 'force-dynamic';

export const PATCH = viewerRoute('/api/profiles/[id]', (api) => api.profiles.update);
export const DELETE = viewerRoute('/api/profiles/[id]', (api) => api.profiles.remove);
