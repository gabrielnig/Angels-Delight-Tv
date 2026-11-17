import { viewerRoute } from '../../../../server/viewer/route';

export const dynamic = 'force-dynamic';

export const POST = viewerRoute('/api/profiles/exit-kids', (api) => api.profiles.exitKids);
