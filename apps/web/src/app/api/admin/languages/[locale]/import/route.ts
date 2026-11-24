import { getActor, spendAdminBudget } from '@/lib/data/admin/session-next';
import { createLanguageHandlers } from '@/lib/i18n/language-routes';
import { translationServiceFor } from '@/lib/i18n/runtime';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  return createLanguageHandlers({
    getActor,
    service: translationServiceFor,
    appOrigin: process.env.APP_ORIGIN ?? '',
    spend: spendAdminBudget,
  }).importCsv(request, (await params).locale);
}
