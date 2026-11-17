import { handleCspReport } from '../../../lib/security/csp-report';
import { getServices } from '../../../lib/runtime/services';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return handleCspReport(request, (entry) => getServices().logger.warn('csp violation', entry));
}
