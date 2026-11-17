import { viewerRoute } from '../../../../server/viewer/route';

export const dynamic = 'force-dynamic';

/** Player progress sink (docs/lanes/G-player.md). Reuses the lane C progress service. */
export const POST = viewerRoute('/api/watch/progress', (api) => api.watchProgress);
