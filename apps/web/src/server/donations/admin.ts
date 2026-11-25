import 'server-only';
import { DonationAdminService } from '@ad/payments';
import type { AdminActor } from '@/lib/data/admin/types';
import { demoMoney, kbDemoMoney } from '@/lib/data/admin/kb-demo/money';
import { adminRuntime } from '../admin/runtime';
import { createPgDonationAdminStore } from './admin-store';

/** The donations admin service for one staff member. Every database call runs as that person (row level security). */
export function donationAdmin(actor: AdminActor): DonationAdminService {
  // The isolated help recording stack has no database: it reads the fake demo gifts held in memory.
  if (kbDemoMoney()) return new DonationAdminService({ store: demoMoney().donations });
  const rt = adminRuntime();
  return new DonationAdminService({
    store: createPgDonationAdminStore(rt.db(), { accountId: actor.accountId, role: actor.role }, rt.fieldKek()),
  });
}
