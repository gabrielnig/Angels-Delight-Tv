import { resolveViewer } from '../../../../lib/data/analytics-viewer';
import { getServices } from '../../../../lib/runtime/services';
import { installRealViewerResolver } from '../../../../server/viewer/install-analytics';
import { createSeenHandler } from '../../../../server/sponsors/seen';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  installRealViewerResolver();
  const secure = getServices().env.APP_ORIGIN.startsWith('https://');
  return createSeenHandler({ resolveViewer, secure })(request);
}
