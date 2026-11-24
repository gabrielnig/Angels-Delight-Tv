import { donateCheckout } from '../../../../server/donations/runtime';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return donateCheckout()(request);
}
