import { viewerRoute } from '../../../../server/viewer/route';

export const dynamic = 'force-dynamic';

export const POST = viewerRoute('/api/progress/import', (api) => api.progress.import);
