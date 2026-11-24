import { paystackWebhook } from '../../../../server/donations/webhook-runtime';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return paystackWebhook()(request);
}

// Anything else is a 405 from the shared handler, so the answer is the same on every method.
export const GET = POST;
export const PUT = POST;
export const DELETE = POST;
export const PATCH = POST;
