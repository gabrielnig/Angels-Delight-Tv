import { donateStatus } from '../../../../server/donations/runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return donateStatus()(request);
}
