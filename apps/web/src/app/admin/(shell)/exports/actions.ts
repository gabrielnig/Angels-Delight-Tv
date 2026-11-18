'use server';

import { Conflict, RateLimited, ValidationFailed } from '@ad/shared';
import { redirect } from 'next/navigation';
import { exportsAdmin } from '@/lib/data/admin/exports';
import { parseExportRequest } from '@/lib/data/admin/exports-rules';
import { requireActionActor, spendAdminBudget } from '@/lib/data/admin/session-next';

const LIST = '/admin/exports';

/**
 * Starts a background export from the confirm page (M19-S05, M20-S03). This is a form post, so opening the
 * confirm page never starts anything. The link back carries a short code, never the error text.
 */
export async function requestExportAction(formData: FormData): Promise<void> {
  const actor = await requireActionActor(LIST);
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === 'string') fields[key] = value;
  const request = parseExportRequest(fields.kind, fields);
  let notice: 'asked' | 'busy' | 'invalid' | 'failed' = 'asked';
  if (!request) {
    notice = 'invalid';
  } else {
    try {
      await spendAdminBudget(actor);
      await exportsAdmin.request(actor, request);
    } catch (error) {
      notice =
        error instanceof RateLimited || error instanceof Conflict
          ? 'busy'
          : error instanceof ValidationFailed
            ? 'invalid'
            : 'failed';
    }
  }
  redirect(`${LIST}?notice=${notice}`);
}
