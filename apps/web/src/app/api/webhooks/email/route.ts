import { createSuppressionStore } from '../../../../server/email/suppression';
import { handleEmailWebhook } from '../../../../server/email/webhook';
import { getServices } from '../../../../lib/runtime/services';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const { env, db, logger } = getServices();
  return handleEmailWebhook(request, {
    secret: env.EMAIL_WEBHOOK_SECRET,
    store: createSuppressionStore(db, env.EMAIL_HASH_PEPPER),
    warn: (message, fields) => logger.warn(message, fields),
  });
}
