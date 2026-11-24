import { getActor, spendAdminBudget } from '@/lib/data/admin/session-next';
import { createLanguageHandlers } from '@/lib/i18n/language-routes';
import { translationServiceFor } from '@/lib/i18n/runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  return createLanguageHandlers({
    getActor,
    service: translationServiceFor,
    appOrigin: process.env.APP_ORIGIN ?? '',
    spend: spendAdminBudget,
  }).exportFile(request, (await params).locale);
}
